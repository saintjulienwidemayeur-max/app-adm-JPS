import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db, openBooking, cargoOf, money, r2 } from "@/lib/wh-store";
import { BOL_TERMS, COMPANY } from "@/lib/company";
import { isoToday } from "@/lib/clock";
import { longDate, shortDate } from "@/lib/fmt";
import { PrintButton } from "@/components/print-button";

const Box = ({ title, children, className = "" }: { title: string; children?: ReactNode; className?: string }) => (
  <div className={`border border-zinc-700 p-1.5 ${className}`}><div className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{title}</div><div className="min-h-6 text-[12px] leading-snug">{children || " "}</div></div>
);
const Party = ({ n, a, c, p }: { n: string; a: string; c: string; p: string }) => <>{n}<br />{a}<br />{c}<br />{p}</>;

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const sh = db.shipments.find((x) => x.name === name);
  if (!sh) notFound();
  const b = openBooking(sh), c = cargoOf(name), air = sh.ship === "Air";
  const marks = [b.containerId && `Container ${b.containerId}`, b.seal && `Seal ${b.seal}`, b.tag && `Tag ${b.tag}`, ...c.pallets.map((p) => p)].filter(Boolean).join(" · ");
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="no-print mb-3 flex justify-end"><PrintButton /></div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-4">
        <div className="text-lg font-bold">{COMPANY.name.toUpperCase()}</div>
        <div className="border border-zinc-700 px-3 py-1 text-xs font-bold tracking-wide">LONG FORM - INTERNATIONAL BILL OF LADING</div>
      </div>
      <div className="mt-1 grid grid-cols-2">
        <Box title="1. Shipper / exporter (name and address)"><Party n={b.shipperName} a={b.shipperAddress} c={b.shipperCity} p={b.shipperContact} /></Box>
        <div className="grid grid-cols-2">
          <Box title={air ? "2. Booking / AWB number" : "2. Booking / bill of lading number"}><b>{b.awb}</b>{b.bol && <><br />BL {b.bol}</>}</Box>
          <Box title="Shipment ID"><b>{sh.name}</b></Box>
          <Box title="3. Export references" className="col-span-2">Cargo ID {sh.cargoId}{b.freightPayableAt ? ` · Freight payable at ${b.freightPayableAt}` : ""}</Box>
        </div>
        <Box title="4. Consignee (name and address)"><Party n={b.consigneeName} a={b.consigneeAddress} c={b.consigneeCity} p={b.consigneeContact} /></Box>
        <Box title="5. Forwarding agent / carrier"><b>{b.line}</b>{b.vessel && b.vessel !== b.line ? ` · ${b.vessel}` : ""}</Box>
        <Box title="6. Notify party">{b.notify}{b.notifyContact && <><br />{b.notifyContact}</>}{b.receiver && <><br />Receiver: {b.receiver}</>}</Box>
        <Box title="7. Domestic routing / instructions">{b.notes}</Box>
      </div>
      <div className="grid grid-cols-4">
        <Box title={air ? "8. Flight date" : "8. Sailing date"}>{shortDate(b.sailDate)}</Box>
        <Box title="9. Vessel / flight">{b.vessel || b.line}</Box>
        <Box title="10. Port of loading">{b.origin}</Box>
        <Box title="11. Port of discharge / place of delivery">{b.destination}</Box>
      </div>

      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="text-[9px] uppercase tracking-wide text-zinc-500">
          {["Marks and numbers", "No. of pieces", "Kind of packages", "Description of goods", "Gross weight (lb / kg)", "Measurement (cuft)"].map((h) => <th key={h} className="border border-zinc-700 p-1 text-left font-semibold">{h}</th>)}
        </tr></thead>
        <tbody><tr className="align-top">
          <td className="h-56 border border-zinc-700 p-1.5">{marks}</td>
          <td className="border border-zinc-700 p-1.5">{c.rows.length}</td>
          <td className="border border-zinc-700 p-1.5">{b.pieceType}</td>
          <td className="border border-zinc-700 p-1.5">{b.commodity}{b.sed === "YES" && <><br />SED required</>}{b.hazmat === "YES" && <><br />HAZARDOUS MATERIAL</>}{b.refrigeration === "YES" && <><br />Refrigeration required</>}</td>
          <td className="border border-zinc-700 p-1.5">{c.lbs} lb<br />{c.kg} kg</td>
          <td className="border border-zinc-700 p-1.5">{c.cuft}</td>
        </tr></tbody>
      </table>

      <div className="grid grid-cols-3">
        <Box title="Declared value for carriage">{money(b.declared)}</Box>
        <Box title="Freight payable at">{b.freightPayableAt}</Box>
        <Box title="Bill of lading cost">{money(r2(b.blCost))}</Box>
      </div>
      <p className="border border-zinc-700 p-1.5 text-[10px] leading-snug text-zinc-700">{BOL_TERMS}</p>
      <div className="grid grid-cols-2">
        <Box title="Signed for the carrier / agent" className="h-24"> </Box>
        <Box title="For JP's Logistics and More LLC">By: ______________________<br />{b.signer}<br />Date: {longDate(isoToday())}</Box>
      </div>
      <p className="mt-1 text-right text-xs font-bold">{sh.name}</p>
    </main>
  );
}
