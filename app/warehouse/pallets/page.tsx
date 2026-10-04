import Link from "next/link";
import { db, findPiece, chargeable, r2, wrCode } from "@/lib/wh-store";
import { loadPiece, unloadPiece, shipCargo } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CameraScan } from "@/components/camera-scan";

export const metadata = { title: "Load pallet · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

const wrOf = (id: string) => { const w = db.wrs.find((x) => x.id === id); return w ? wrCode(w) : id; };

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const d = new Date(), ship = q.ship === "Ocean" ? "Ocean" : "Air";
  const stamp = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
  const shipment = q.shipment || (ship === "Air" ? `PL-AIR-${stamp}` : `CT-OCEAN-${stamp}`);
  const pallet = q.pallet || (ship === "Air" ? "Pallet 1" : "Container 1");
  const sh = db.shipments.find((x) => x.name === shipment);
  const rows = db.loads.filter((l) => l.shipment === shipment).map((l) => ({ l, p: findPiece(l.no)!.p }));
  const lbs = r2(rows.reduce((a, r) => a + r.p.lbs, 0));
  const chg = r2(rows.reduce((a, r) => a + chargeable(r.p), 0));
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1>Load pallet or container</h1>
      <form action={loadPiece} className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-[6rem_1.2fr_1fr_1.5fr_auto]">
        <select name="ship" defaultValue={sh?.ship ?? ship} aria-label="Ship type" className="h-9 rounded-md border bg-white px-2 text-sm"><option>Air</option><option>Ocean</option></select>
        <Input name="shipment" list="shipments" defaultValue={shipment} aria-label="Shipment" />
        <Input name="pallet" defaultValue={pallet} aria-label="Pallet or container" />
        <div className="flex gap-1"><Input id="code" name="code" placeholder="Scan piece label" autoFocus required /><CameraScan target="code" submit /></div>
        <Button type="submit">Load</Button>
        <datalist id="shipments">{db.shipments.filter((x) => !x.shipped).map((x) => <option key={x.name} value={x.name} />)}</datalist>
      </form>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{/^\d+$/.test(q.ok) ? `Piece ${q.ok} loaded on ${pallet}.` : q.ok}</p>}
      {q.warn && <p role="alert" className="mt-1 text-sm font-medium text-amber-700">{q.warn}</p>}
      {sh && <p className="mt-3 text-sm text-zinc-700">Cargo ID <b>{sh.cargoId}</b> · created {sh.date} · {sh.shipped ? <b className="text-green-700">Shipped {sh.shipped}</b> : "Open"} · <Link href={`/warehouse/shipments/${encodeURIComponent(sh.name)}`} className="text-brand underline">Booking and documents</Link></p>}
      {rows.length === 0 ? <p className="mt-6 text-sm text-zinc-600">Nothing loaded on {shipment} yet. Scan a piece label to start.</p> : (
        <>
          <table className="mt-3 w-full text-left text-sm">
            <thead><tr>{["Loaded", "WR – item", "Weight (lb)", "Chargeable (lb)", "Pallet", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(({ l, p }) => (
              <tr key={l.no} className="border-b border-zinc-100"><td className={td}>{l.date}</td><td className={td}>{wrOf(l.wr)} – {l.no}</td><td className={td}>{p.lbs}</td><td className={td}>{chargeable(p)}</td><td className={td}>{l.pallet}</td>
                <td className={td}>{!sh?.shipped && <form action={unloadPiece}><input type="hidden" name="no" value={l.no} /><button className="text-red-700 underline" aria-label={`Remove ${l.no}`}>Remove</button></form>}</td></tr>))}</tbody>
            <tfoot><tr className="font-semibold"><td className={td}>{rows.length} pieces</td><td /><td className={td}>{lbs}</td><td className={td}>{chg}</td><td className={td} colSpan={2}>{r2(lbs * 0.45359)} KG</td></tr></tfoot>
          </table>
          <div className="mt-4 flex gap-2">
            <Link href={`/warehouse/pallets/labels?shipment=${encodeURIComponent(shipment)}`} className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100">Print pallet labels</Link>
            {!sh?.shipped && <form action={shipCargo}><input type="hidden" name="shipment" value={shipment} /><input type="hidden" name="pallet" value={pallet} /><input type="hidden" name="ship" value={sh?.ship ?? ship} /><Button type="submit">Ship this cargo</Button></form>}
          </div>
        </>
      )}
    </main>
  );
}
