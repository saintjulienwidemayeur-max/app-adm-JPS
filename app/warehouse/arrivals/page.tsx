import { db, money, balance, wrCode } from "@/lib/wh-store";
import { receiveHere, arriveShipment, markHereNotified, markReady } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CameraScan } from "@/components/camera-scan";

export const metadata = { title: "Arrivals PV · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const lnk = "inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium hover:bg-zinc-100";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const shipped = db.shipments.filter((x) => x.shipped);
  const loads = db.loads.filter((l) => shipped.some((x) => x.name === l.shipment));
  const cust = (wr: string) => db.wrs.find((w) => w.id === wr)?.customer ?? "";
  const code = (wr: string) => { const w = db.wrs.find((x) => x.id === wr); return w ? wrCode(w) : wr; };
  const expected = shipped.map((sh) => ({ sh, rows: loads.filter((l) => l.shipment === sh.name && !l.here) })).filter((g) => g.rows.length);
  const hereWrs = [...new Set(loads.filter((l) => l.here).map((l) => l.wr))].map((id) => {
    const w = db.wrs.find((x) => x.id === id)!;
    const mine = loads.filter((l) => l.wr === id);
    return { w, here: mine.filter((l) => l.here).length, total: mine.length };
  });
  const nExpected = expected.reduce((a, g) => a + g.rows.length, 0);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Arrivals · Pétion-Ville</h1>
      <p className="text-sm text-zinc-600">Scan each piece label as cargo arrives in Haiti. Customers are told once their pieces are here.</p>
      <form action={receiveHere} className="mt-4 grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-3 sm:max-w-xl">
        <div className="flex gap-1"><Input id="code" name="code" placeholder="Scan piece label" autoFocus required /><CameraScan target="code" submit /></div>
        <Button type="submit">Receive</Button>
      </form>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}
      {q.warn && <p role="alert" className="mt-1 text-sm font-medium text-amber-700">{q.warn}</p>}

      <h2 className="mt-6 font-bold">Expected ({nExpected} pieces)</h2>
      {expected.length === 0 ? <p className="mt-1 text-sm text-zinc-600">Nothing is waiting. Cargo shows up here once it is marked as shipped.</p> : expected.map(({ sh, rows }) => (
        <section key={sh.name} className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span><b>{sh.name}</b> · Cargo ID {sh.cargoId} · shipped {sh.shipped} · {rows.length} to receive</span>
            <form action={arriveShipment}><input type="hidden" name="shipment" value={sh.name} /><Button type="submit" variant="outline">Mark all as here</Button></form>
          </div>
          <table className="w-full text-left text-sm">
            <thead><tr>{["WR", "Customer", "Item", "Pallet"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((l) => <tr key={l.no} className="border-b border-zinc-100"><td className={td}>{code(l.wr)}</td><td className={td}>{cust(l.wr)}</td><td className={td}>{l.no}</td><td className={td}>{l.pallet}</td></tr>)}</tbody>
          </table>
        </section>
      ))}

      <h2 className="mt-8 font-bold">Here ({hereWrs.length} receipts)</h2>
      {hereWrs.length === 0 ? <p className="mt-1 text-sm text-zinc-600">No pieces received here yet.</p> : (
        <table className="mt-2 w-full text-left text-sm">
          <thead><tr>{["WR", "Customer", "Pieces here", "Balance", "Customer notified", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{hereWrs.map(({ w, here, total }) => {
            const bal = Math.max(0, balance(w));
            const mail = `mailto:${w.email}?subject=${encodeURIComponent(`JP's Logistics – your package is here (${wrCode(w)})`)}&body=${encodeURIComponent(`Hello ${w.customer},\n\nYour package(s) for receipt ${wrCode(w)} have arrived in Pétion-Ville.\n\nJP's Logistics & More`)}`;
            return (
              <tr key={w.id} className="border-b border-zinc-100">
                <td className={td}>{wrCode(w)}</td><td className={td}>{w.customer}</td>
                <td className={td}>{here} of {total}{here < total && <span className="ml-1 text-amber-700">· partial</span>}</td>
                <td className={td}>{money(bal)}</td><td className={td}>{w.hereNotified ? "Yes" : "No"}</td>
                <td className={`${td} flex gap-2`}>
                  {w.email ? <a href={mail} className={lnk}>Email customer</a> : <span className="text-xs text-zinc-500">No email on receipt</span>}
                  {here === total && !w.ready && <form action={markReady}><input type="hidden" name="wr" value={w.id} /><button className={lnk}>Ready for pickup</button></form>}
                  {w.ready && <span className="text-xs font-medium text-green-700">Ready for pickup</span>}
                  {!w.hereNotified && <form action={markHereNotified}><input type="hidden" name="wr" value={w.id} /><button className={lnk}>Mark notified</button></form>}
                </td>
              </tr>);
          })}</tbody>
        </table>
      )}
    </main>
  );
}
