import { notFound } from "next/navigation";
import { db, openBooking, cargoOf, r2, money } from "@/lib/wh-store";
import { COMPANY } from "@/lib/company";
import { isoToday } from "@/lib/clock";
import { longDate, shortDate, cm, r1 } from "@/lib/fmt";
import { PrintButton } from "@/components/print-button";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const sh = db.shipments.find((x) => x.name === name);
  if (!sh) notFound();
  const b = openBooking(sh), c = cargoOf(name), air = sh.ship === "Air";
  const lines = c.pallets.map((p, i) => {
    const info = b.pallets[p] ?? { type: "PALLET", l: 0, w: 0, h: 0 }, mine = c.rows.filter((x) => x.l.pallet === p);
    const lbs = r2(mine.reduce((a, x) => a + x.p.lbs, 0)), dims = info.l && info.w && info.h;
    return `# ${i + 1} ${info.type} (${p}) - ${mine.length} pc${mine.length === 1 ? "" : "s"}${dims ? ` - ${info.l} X ${info.w} X ${info.h} in` : ""} - ${lbs} lbs${dims ? ` / ${cm(info.l)} X ${cm(info.w)} X ${cm(info.h)} cm` : ""} - ${r1(lbs * 0.45359)} KG`;
  });
  const total = r2(b.contents.reduce((a, l) => a + l.value, 0));
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-16 w-auto" /><PrintButton />
      </div>
      <h1 className="mt-2 text-center !text-2xl !text-black">Shipper&apos;s Letter of Instruction</h1>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
        <div><span className="text-zinc-500">JP&apos;s Shipment ID:</span> <b>{sh.name}</b></div>
        <div className="text-right"><span className="text-zinc-500">{air ? "Flight date:" : "Sailing date:"}</span> <b>{shortDate(b.sailDate)}</b></div>
        <div><span className="text-zinc-500">Carrier:</span> <b>{b.line}</b></div>
        <div className="text-right"><span className="text-zinc-500">Orig:</span> <b>{b.origin}</b></div>
        <div><span className="text-zinc-500">{air ? "AWB #:" : "Booking #:"}</span> <b>{b.awb}</b></div>
        <div className="text-right"><span className="text-zinc-500">Dest:</span> <b>{b.destination}</b></div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6">
        {[["SHIPPER", b.shipperName, b.shipperAddress, b.shipperCity, b.shipperContact], ["CONSIGNEE", b.consigneeName, b.consigneeAddress, b.consigneeCity, b.consigneeContact]].map(([t, ...rows]) => (
          <div key={t} className="border-2 border-zinc-700">
            <div className="border-b-2 border-zinc-700 bg-zinc-100 py-0.5 text-center text-xs font-bold tracking-wide">{t}</div>
            <div className="min-h-24 space-y-0.5 px-2 py-1.5">{rows.map((r, i) => <div key={i}>{r || " "}</div>)}</div>
          </div>))}
      </div>

      <ul className="mt-4 space-y-0.5 border-y border-zinc-400 py-2 text-xs">
        {lines.length ? lines.map((l) => <li key={l}>{l}</li>) : <li className="text-zinc-500">Nothing is loaded on this shipment yet.</li>}
        {lines.length > 0 && <li className="pt-1 font-semibold">Total: {c.rows.length} piece{c.rows.length === 1 ? "" : "s"} - {c.lbs} lbs - {r1(c.kg)} KG - {c.cuft} cuft</li>}
      </ul>

      <table className="mx-auto mt-4 w-4/5">
        <thead className="border-b-2 border-black"><tr><th className="px-2 py-1 text-left text-xs font-bold tracking-wide">ENCLOSED CONTENTS</th><th className="px-2 py-1 text-right text-xs font-bold tracking-wide">VALUE</th></tr></thead>
        <tbody>{b.contents.map((l, i) => <tr key={i} className="border-b border-zinc-300"><td className="px-2 py-1">{l.label || " "}</td><td className="px-2 py-1 text-right">{l.label || l.value ? money(l.value) : ""}</td></tr>)}</tbody>
        <tfoot><tr className="border-t-2 border-black font-bold"><td className="px-2 py-1" /><td className="px-2 py-1 text-right">{money(total)}</td></tr></tfoot>
      </table>

      <div className="mt-10 space-y-1">
        <div className="inline-block border-2 border-zinc-700 px-2 py-1 font-semibold">SED Required: {b.sed}</div>
        <div>Refrigeration Required: <b>{b.refrigeration}</b></div>
        <div>Hazardous Material: <b>{b.hazmat}</b></div>
        <p className="pt-2 font-medium">Please call {COMPANY.phone} for Credit Card Payment information as soon as the {air ? "AWB" : "booking"} is processed.</p>
      </div>

      <div className="mt-16 grid grid-cols-[1fr_1fr] gap-8">
        <div className="border-t border-black pt-1 text-xs text-zinc-600">Signature</div>
        <div className="border-t border-black pt-1 text-xs text-zinc-600">Print name: <b className="text-sm text-black">{b.signer}</b></div>
      </div>
      <p className="mt-4 text-right">Date: <b>{longDate(isoToday())}</b></p>
    </main>
  );
}
