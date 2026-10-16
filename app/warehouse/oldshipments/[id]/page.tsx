import Link from "next/link";
import { notFound } from "next/navigation";
import { db, money } from "@/lib/wh-store";

export const dynamic = "force-dynamic";
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = db.oldShips.find((x) => x.id === id);
  if (!s) notFound();
  const items = new Set(s.items);
  // Receipts with pieces on this shipment, and how many.
  const wrs = db.oldWrs.filter((w) => w.ships.includes(s.id)).map((w) => ({ w, n: w.pieces.filter((p) => items.has(p.n)).length, lbs: Math.round(w.pieces.filter((p) => items.has(p.n)).reduce((a, p) => a + p.lbs, 0) * 100) / 100 }));
  const names = new Map(db.customers.map((c) => [c.no, c.name]));
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 text-sm">
      <Link href="/warehouse/oldshipments" className="text-brand underline">All old shipments</Link>
      <h1>{s.name || `Shipment ${s.id}`} <span className="text-base font-normal text-zinc-600">· {s.type}</span></h1>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {([["Date", s.date], ["Sailed / flew", s.sail], ["Arrived", s.arrival], ["AWB", s.awb], ["Bill of lading", s.bol], ["Container", s.container], ["Seal", ""], ["Line", s.line], ["Vessel", s.vessel], ["Cost", s.cost ? money(s.cost) : ""], ["Shipper", s.shipper], ["Consignee", s.consignee]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-zinc-500">{k}</dt><dd>{v || "–"}</dd></div>)}
      </dl>
      <h2 className="mt-5 font-bold">Receipts on this shipment ({wrs.length} · {s.items.length} pieces)</h2>
      {wrs.length === 0 ? <p className="mt-1 text-zinc-600">No receipt found for the pieces of this shipment.</p> : (
        <table className="mt-1 w-full text-left"><thead><tr>{["Receipt", "Customer", "Type", "Pieces here", "Weight (lb)"].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>{wrs.map(({ w, n, lbs }) => <tr key={w.wr} className="border-b border-zinc-100"><td className={`${td} font-semibold`}><Link href={`/warehouse/oldreceipts/${w.wr}`} className="text-brand underline">{w.wr}</Link></td><td className={td}>{names.get(w.cust) ?? w.shipper ?? w.cust} <span className="text-xs text-zinc-500">#{w.cust}</span></td><td className={td}>{w.ship}</td><td className={td}>{n}</td><td className={td}>{lbs}</td></tr>)}</tbody></table>
      )}
    </main>
  );
}
