import Link from "next/link";
import { notFound } from "next/navigation";
import { db, money } from "@/lib/wh-store";

export const dynamic = "force-dynamic";
const th = "px-2 py-1 font-semibold", td = "px-2 py-1 align-top";

export default async function Page({ params }: { params: Promise<{ wr: string }> }) {
  const { wr } = await params;
  const w = db.oldWrs.find((x) => x.wr === wr);
  if (!w) notFound();
  const c = db.customers.find((x) => x.no === w.cust);
  const ships = w.ships.map((id) => db.oldShips.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  const lbs = Math.round(w.pieces.reduce((a, p) => a + p.lbs, 0) * 100) / 100;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 text-sm">
      <Link href="/warehouse/oldreceipts" className="text-brand underline">All old receipts</Link>
      <h1>Old receipt {w.wr} <span className="text-base font-normal text-zinc-600">· {w.ship} · {w.date}</span></h1>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <div><dt className="text-xs text-zinc-500">Customer</dt><dd className="font-medium"><Link href={`/warehouse/customers/${w.cust}`} className="text-brand underline">{c?.name ?? w.shipper ?? w.cust}</Link> <span className="text-xs text-zinc-500">#{w.cust}</span></dd></div>
        <div><dt className="text-xs text-zinc-500">Shipper (from)</dt><dd>{w.shipper || "–"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Bill to</dt><dd>{w.billTo ? `#${w.billTo}` : "–"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Category</dt><dd>{w.kind || "–"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Handling fees</dt><dd>{money(w.handling)}</dd></div>
        <div><dt className="text-xs text-zinc-500">Other fees</dt><dd>{money(w.other)}</dd></div>
        <div><dt className="text-xs text-zinc-500">Credit</dt><dd>{money(w.credit)}</dd></div>
        <div><dt className="text-xs text-zinc-500">Payment received</dt><dd>{money(w.paid)}{w.method && ` · ${w.method}`}</dd></div>
        <div><dt className="text-xs text-zinc-500">Invoiced</dt><dd>{w.invoiced ? "Yes" : "No"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Paid in full</dt><dd>{w.paidFull ? "Yes" : "No"}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-zinc-500">Declared contents</dt><dd>{w.contents || "–"}</dd></div>
        {w.comments && <div className="col-span-full"><dt className="text-xs text-zinc-500">Comments</dt><dd>{w.comments}</dd></div>}
      </dl>
      <h2 className="mt-5 font-bold">Pieces ({w.pieces.length} · {lbs} lb)</h2>
      {w.pieces.length === 0 ? <p className="mt-1 text-zinc-600">No piece recorded.</p> : (
        <table className="mt-1 w-full text-left"><thead><tr>{["Item", "Type", "L×W×H (in)", "Weight (lb)", "Cuft", "Contents", "Loaded", "Shipped", "Delivered"].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>{w.pieces.map((p) => <tr key={p.n} className="border-b border-zinc-100"><td className={td}>{p.n}</td><td className={td}>{p.type}</td><td className={td}>{p.l}×{p.w}×{p.h}</td><td className={td}>{p.lbs}</td><td className={td}>{p.cuft}</td><td className={td}>{p.contents || "–"}</td><td className={td}>{p.loaded ? "Yes" : "–"}</td><td className={td}>{p.shipped ? "Yes" : "–"}</td><td className={td}>{p.delivered ? "Yes" : "–"}</td></tr>)}</tbody></table>
      )}
      <h2 className="mt-5 font-bold">Parcels scanned ({w.scans.length})</h2>
      {w.scans.length === 0 ? <p className="mt-1 text-zinc-600">No parcel scanned for this receipt.</p> : (
        <table className="mt-1 w-full text-left"><thead><tr>{["Tracking", "Received", "Carrier", "Type", "Customer told"].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>{w.scans.map((s, i) => <tr key={i} className="border-b border-zinc-100"><td className={`${td} font-mono text-xs`}>{s.t}</td><td className={td}>{s.date || "–"}</td><td className={td}>{s.carrier}</td><td className={td}>{s.ship}</td><td className={td}>{s.notified ? "Yes" : "No"}</td></tr>)}</tbody></table>
      )}
      <h2 className="mt-5 font-bold">Shipments</h2>
      {ships.length === 0 ? <p className="mt-1 text-zinc-600">Not on a shipment of the old system.</p> : <ul className="mt-1 list-disc pl-5">{ships.map((s) => <li key={s.id}><Link href={`/warehouse/oldshipments/${s.id}`} className="text-brand underline">{s.name || s.id}</Link> · {s.type} · {s.date || "–"}</li>)}</ul>}
    </main>
  );
}
