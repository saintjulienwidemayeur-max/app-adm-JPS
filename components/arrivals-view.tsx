import { db, money, balance, wrCode, shToUSA } from "@/lib/wh-store";
import { receiveHere, undoReceiveHere, arriveShipment, markHereNotified, markReady, notifyEmail } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanField } from "@/components/scan-field";
import { CameraScan } from "@/components/camera-scan";

const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const lnk = "inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium hover:bg-zinc-100";

// Shared by Arrivals PV (cargo from Miami) and Arrivals Miami (cargo from Haiti, `usa`).
export function ArrivalsView({ q, usa }: { q: Record<string, string | undefined>; usa: boolean }) {
  const base = usa ? "/warehouse/arrivals-miami" : "/warehouse/arrivals";
  const shipped = db.shipments.filter((x) => x.shipped && shToUSA(x) === usa);
  const shippedNames = new Set(shipped.map((x) => x.name));
  const loads = db.loads.filter((l) => shippedNames.has(l.shipment));
  // Looked up once: the history holds thousands of receipts and pieces.
  const wrById = new Map(db.wrs.map((w) => [w.id, w]));
  const cust = (wr: string) => wrById.get(wr)?.customer ?? "";
  const code = (wr: string) => { const w = wrById.get(wr); return w ? wrCode(w) : wr; };
  const byShip = new Map<string, typeof loads>(), byWr = new Map<string, typeof loads>();
  for (const l of loads) { (byShip.get(l.shipment) ?? byShip.set(l.shipment, []).get(l.shipment)!).push(l); (byWr.get(l.wr) ?? byWr.set(l.wr, []).get(l.wr)!).push(l); }
  const expected = shipped.map((sh) => ({ sh, rows: (byShip.get(sh.name) ?? []).filter((l) => !l.here) })).filter((g) => g.rows.length);
  const allHere = [...byWr].filter(([id, mine]) => wrById.has(id) && mine.some((l) => l.here));
  const SHOWN = 100; // the receipts that arrived long ago stay in the history, not on this screen
  const hereWrs = (q.all === "1" ? allHere : allHere.slice(-SHOWN)).reverse().map(([id, mine]) => {
    const w = wrById.get(id)!;
    return { w, here: mine.filter((l) => l.here).length, total: mine.length, by: [...new Set(mine.filter((l) => l.here && l.hereBy).map((l) => l.hereBy!))].join(", ") };
  });
  const nExpected = expected.reduce((a, g) => a + g.rows.length, 0);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>{usa ? "Arrivals · Miami" : "Arrivals · Pétion-Ville"}</h1>
      <p className="text-sm text-zinc-600">Scan each piece label as cargo arrives {usa ? "in Miami (sent from Haiti)" : "in Haiti"}. Customers are told once their pieces are here.</p>
      <form action={receiveHere} className="mt-4 grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-3 sm:max-w-xl">
        <input type="hidden" name="dir" value={usa ? "USA" : ""} />
        <div className="flex gap-1"><ScanField id="code" name="code" placeholder="Scan piece label" /><CameraScan target="code" submit /></div>
        <Button type="submit">Receive</Button>
      </form>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}
      {q.warn && <p role="alert" className="mt-1 text-sm font-medium text-amber-700">{q.warn}</p>}

      <details className="mt-2 text-sm"><summary className="cursor-pointer text-brand underline">Scanned a piece by mistake?</summary>
        <form action={undoReceiveHere} className="mt-1 flex max-w-xl gap-1"><input type="hidden" name="dir" value={usa ? "USA" : ""} /><Input name="code" placeholder="Piece number or label to take back to Expected" aria-label="Piece to undo" required /><Button type="submit" variant="outline">Undo</Button></form>
      </details>

      <h2 className="mt-6 font-bold">Expected ({nExpected} pieces)</h2>
      {expected.length === 0 ? <p className="mt-1 text-sm text-zinc-600">Nothing is waiting. Cargo {usa ? "from Haiti " : ""}shows up here once it is marked as shipped.</p> : expected.map(({ sh, rows }) => (
        <section key={sh.name} className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span><b>{sh.name}</b> · Cargo ID {sh.cargoId} · shipped {sh.shipped} · {rows.length} to receive</span>
            <form action={arriveShipment}><input type="hidden" name="shipment" value={sh.name} /><Button type="submit" variant="outline">Mark all as here</Button></form>
          </div>
          <table className="w-full text-left text-sm">
            <thead><tr>{["WR", "Customer", "Item", "Pallet"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 40).map((l) => <tr key={l.no} className="border-b border-zinc-100"><td className={td}>{code(l.wr)}</td><td className={td}>{cust(l.wr)}</td><td className={td}>{l.no}</td><td className={td}>{l.pallet}</td></tr>)}</tbody>
          </table>
          {rows.length > 40 && <p className="mt-1 text-xs text-zinc-600">The first 40 of {rows.length} pieces are listed. Scan a piece label above, or use Mark all as here.</p>}
        </section>
      ))}

      <h2 className="mt-8 font-bold">Here ({allHere.length} receipts{allHere.length > hereWrs.length ? `, the latest ${hereWrs.length} shown` : ""})</h2>
      {allHere.length > hereWrs.length && <p className="text-xs"><a href={`${base}?all=1`} className="text-brand underline">Show all</a></p>}
      {hereWrs.length === 0 ? <p className="mt-1 text-sm text-zinc-600">No pieces received here yet.</p> : (
        <table className="mt-2 w-full text-left text-sm">
          <thead><tr>{["WR", "Customer", "Pieces here", "Received by", "Balance", "Customer notified", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{hereWrs.map(({ w, here, total, by }) => {
            const bal = Math.max(0, balance(w));
            return (
              <tr key={w.id} className="border-b border-zinc-100">
                <td className={td}>{wrCode(w)}</td><td className={td}>{w.customer}</td>
                <td className={td}>{here} of {total}{here < total && <span className="ml-1 text-amber-700">· partial</span>}</td>
                <td className={td}>{by || "–"}</td><td className={td}>{money(bal)}</td><td className={td}>{w.hereNotified ? "Yes (automatic)" : here === total ? "Not set up" : "When all pieces are here"}</td>
                <td className={`${td} flex gap-2`}>
                  {here === total && !w.ready && <form action={markReady}><input type="hidden" name="wr" value={w.id} /><button className={lnk}>Ready for pickup</button></form>}
                  {w.ready && <span className="text-xs font-medium text-green-700">Ready for pickup</span>}
                  {here === total && <span className="text-xs text-zinc-500">The customer is told by itself</span>}
                  {here > 0 && <form><button formAction={notifyEmail.bind(null, w.id, w.ready ? "ready" : "arrived", base)} className={lnk}>Notify by e-mail</button></form>}
                </td>
              </tr>);
          })}</tbody>
        </table>
      )}
    </main>
  );
}
