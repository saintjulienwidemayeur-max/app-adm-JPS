import Link from "next/link";
import { notFound } from "next/navigation";
import { db, openBooking, cargoOf, custOf, vol, cuft, chargeable, wrCode, r2 } from "@/lib/wh-store";
import { shortDate } from "@/lib/fmt";
import { PrintButton } from "@/components/print-button";

const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const sh = db.shipments.find((x) => x.name === name);
  if (!sh) notFound();
  const b = openBooking(sh), c = cargoOf(name);
  const rows = [...c.rows].sort((x, y) => x.l.pallet.localeCompare(y.l.pallet, undefined, { numeric: true }) || Number(x.w.id) - Number(y.w.id) || x.p.no - y.p.no);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 text-sm">
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-14 w-auto" />
        <h1 className="flex-1 text-xl font-bold">Cargo list</h1><PrintButton />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <div><dt className="text-xs text-zinc-500">Shipment</dt><dd className="font-semibold"><Link href={`/warehouse/shipments/${encodeURIComponent(name)}`} className="text-brand underline print:no-underline">{name}</Link></dd></div>
        <div><dt className="text-xs text-zinc-500">Ship type</dt><dd>{sh.ship}</dd></div>
        <div><dt className="text-xs text-zinc-500">{sh.ship === "Air" ? "Airline" : "Shipping line"}</dt><dd>{b.line || "–"}</dd></div>
        <div><dt className="text-xs text-zinc-500">{sh.ship === "Air" ? "Flight date" : "Sailing date"}</dt><dd>{shortDate(b.sailDate) || "–"}</dd></div>
      </dl>
      {rows.length === 0 ? <p className="mt-6 text-zinc-600">Nothing is loaded on this shipment yet.</p> : (
        <table className="mt-4 w-full text-left">
          <thead className="border-b-2 border-black"><tr>{["Pallet", "Consignee", "WR", "Item", "Type", "L×W×H (in)", "Lbs", "Chargeable", "Cuft"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(({ l, w, p }) => (
            <tr key={p.no} className="border-b border-zinc-300">
              <td className={td}>{l.pallet}</td><td className={td}>{custOf(w)?.consignee || w.customer}</td><td className={td}>{wrCode(w)}</td><td className={td}>{p.no}</td><td className={td}>{p.type}</td>
              <td className={td}>{p.l}×{p.w}×{p.h}</td><td className={td}>{p.lbs}</td><td className={td}>{r2(chargeable(p))}</td><td className={td}>{cuft(p)}</td>
            </tr>))}</tbody>
          <tfoot><tr className="border-t-2 border-black font-semibold"><td className={td} colSpan={6}>{rows.length} piece{rows.length === 1 ? "" : "s"} on {c.pallets.length} pallet{c.pallets.length === 1 ? "" : "s"}</td><td className={td}>{c.lbs}</td><td className={td}>{c.chargeable}</td><td className={td}>{c.cuft}</td></tr>
            <tr className="font-semibold"><td className={td} colSpan={6} /><td className={td} colSpan={3}>{c.kg} kg</td></tr></tfoot>
        </table>
      )}
    </main>
  );
}
