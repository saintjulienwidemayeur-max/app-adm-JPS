import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db, openBooking, cargoOf, cuft, vol, r2, money, wrCode, receiverOf, shToUSA } from "@/lib/wh-store";
import { COMPANY } from "@/lib/company";
import { shortDate } from "@/lib/fmt";
import { PrintButton } from "@/components/print-button";

// Proof of export: the customer's own Long Form International Bill of Lading inside a shipment (same layout as the shipment's
// Bill of Lading, but only this customer's receipts and pieces). It is what a customer who ships merchandise for a vendor
// asks for: proof that everything JP's received for them left on this flight or vessel.
const Box = ({ n, title, children, className = "" }: { n: string; title: string; children?: ReactNode; className?: string }) => (
  <div className={`border border-zinc-700 p-1.5 ${className}`}><div className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">({n}) {title}</div><div className="min-h-6 text-[12px] font-semibold leading-snug">{children || " "}</div></div>
);

export default async function Page({ params }: { params: Promise<{ name: string; cust: string }> }) {
  const { name: rawName, cust: rawCust } = await params;
  const name = decodeURIComponent(rawName), cno = Number(rawCust);
  const sh = db.shipments.find((x) => x.name === name);
  const cust = db.customers.find((c) => c.no === cno);
  if (!sh || !cust) notFound();
  const b = openBooking(sh), air = sh.ship === "Air";
  const rows = cargoOf(name).rows.filter((x) => x.w.cust === cno);
  if (!rows.length) notFound();
  const wrs = [...new Map(rows.map((x) => [x.w.id, x.w])).values()];
  const lbs = r2(rows.reduce((a, x) => a + x.p.lbs, 0)), cf = r2(rows.reduce((a, x) => a + cuft(x.p), 0));
  const declared = r2(wrs.reduce((a, w) => a + w.declared, 0));
  // Export references: one line per receipt and kind of package, like "8326 - 4 BOX - OTHERS, 3cu, 78lbs".
  const refs = wrs.flatMap((w) => {
    const g = new Map<string, { n: number; cu: number; lbs: number }>();
    for (const x of rows.filter((r) => r.w.id === w.id)) { const e = g.get(x.p.type) ?? { n: 0, cu: 0, lbs: 0 }; g.set(x.p.type, { n: e.n + 1, cu: e.cu + cuft(x.p), lbs: e.lbs + x.p.lbs }); }
    return [...g].map(([type, e]) => `${w.id} - ${e.n} ${type}${e.n > 1 && type.endsWith("OTHER") ? "S" : ""}, ${Math.round(e.cu)}cu, ${r2(e.lbs)}lbs`);
  });
  const [mm, dd, yy] = shortDate(b.sailDate).split("/");
  const docNo = `PL-${air ? "AIR" : "SEA"}-${(mm ?? "").padStart(2, "0")}-${(dd ?? "").padStart(2, "0")}-${yy ?? ""}`;
  // Miami -> Haiti: the customer's consignee in Haiti. Haiti -> Miami: the receiver typed on the receipt (address in the USA).
  const usa = shToUSA(sh), rc = receiverOf(wrs[0]), place = usa ? "USA" : [cust.consigneeCity, cust.consigneeCountry].filter(Boolean).join(", ");
  const shipperCity = cust.billing || "";
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="no-print mb-3 flex items-center justify-between"><Link href={`/warehouse/shipments/${encodeURIComponent(name)}`} className="text-brand underline">← Back to the shipment</Link><PrintButton /></div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-4">
        <div className="text-lg font-bold">{COMPANY.name.toUpperCase()}</div>
        <div className="border border-zinc-700 px-3 py-1 text-xs font-bold tracking-wide">LONG FORM - INTERNATIONAL BILL OF LADING</div>
      </div>
      <p className="mt-1 text-xs font-semibold tracking-wide text-zinc-600">PROOF OF EXPORT · {cust.name} · shipment {sh.name}</p>

      <div className="mt-1 grid grid-cols-2">
        <div>
          <Box n="2" title="Shipper/Exporter (Embarcador/Remitente)">{cust.name}<br />{shipperCity}</Box>
          <Box n="3" title="Consignee (Consignatario)">{rc.name}<br />{[rc.address, place].filter(Boolean).join(", ")}</Box>
          <Box n="4" title="Notify party (Dirigir Notificacion de Llegada a)">{rc.name}{rc.phone && <><br />{rc.phone}</>}</Box>
        </div>
        <div>
          <div className="grid grid-cols-2"><Box n="5" title="Booking no. (No. Reservacion)">{b.awb}</Box><Box n="5A" title="B/L no. (No. Conocimiento)">{b.bol || b.awb}</Box></div>
          <Box n="6" title="Export references (Referencia de Exportacion)"><span className="block text-[11px] font-bold leading-tight">{refs.map((r) => <span key={r} className="block">{r}</span>)}</span></Box>
          <Box n="7" title="Freight forwarder/CHB (Agente Aduanal)">{COMPANY.name}</Box>
          <Box n="8" title="Point and country of origin (Punto y Pais de Origen)">{b.origin}</Box>
          <Box n="9" title="Also notify - routing instructions">{b.notes}</Box>
        </div>
      </div>
      <div className="grid grid-cols-3">
        <Box n="12" title="Initial carriage by (Mode)">{b.line}</Box>
        <Box n="13" title="Place of initial receipt">{b.origin}</Box>
        <Box n="9A" title="Final destination of the goods">{b.destination}</Box>
        <Box n="14" title={air ? "Vessel (Nave) / flight" : "Vessel (Nave) / voy"}>{b.vessel || b.line}</Box>
        <Box n="15" title="Port of loading">{b.origin}</Box>
        <Box n="10A" title="Originals to be released at">{b.destination}</Box>
        <Box n="16" title="Port of discharge">{b.destination}</Box>
        <Box n="17" title="Place of delivery">{b.destination}</Box>
        <Box n="11" title="Type of move">{air ? "Air" : "Ocean"} · {air ? "Flight date" : "Sailing date"} {shortDate(b.sailDate)}</Box>
      </div>

      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="text-[9px] uppercase tracking-wide text-zinc-500">
          {["(18) Marks and numbers", "(19) No. of pkgs.", "(20) Description of packages and goods", "(21) Gross weight (lbs / cf)", "(22) Measurement"].map((h) => <th key={h} className="border border-zinc-700 p-1 text-left font-semibold">{h}</th>)}
        </tr></thead>
        <tbody>{rows.map(({ l, w, p }) => (
          <tr key={p.no} className="align-top">
            <td className="border-x border-zinc-700 p-1">{wrCode(w)} · {p.no}{l.pallet ? ` · ${l.pallet}` : ""}</td>
            <td className="border-x border-zinc-700 p-1">1 - {p.type}</td>
            <td className="border-x border-zinc-700 p-1">{p.contents || w.contents}</td>
            <td className="border-x border-zinc-700 p-1">{p.lbs} lbs - {cuft(p)}cf{vol(p) > p.lbs ? ` (vol. ${vol(p)} lbs)` : ""}.</td>
            <td className="border-x border-zinc-700 p-1">{p.l}(l) x {p.w}(w) x {p.h}(h)</td>
          </tr>))}
          <tr className="border-t-2 border-zinc-700 font-bold"><td className="border border-zinc-700 p-1">Total</td><td className="border border-zinc-700 p-1">{rows.length} pkg{rows.length === 1 ? "" : "s"}</td><td className="border border-zinc-700 p-1">{wrs.length} receipt{wrs.length === 1 ? "" : "s"}: {wrs.map(wrCode).join(", ")}</td><td className="border border-zinc-700 p-1">{lbs} lbs - {cf}cf</td><td className="border border-zinc-700 p-1" /></tr>
        </tbody>
      </table>

      <div className="grid grid-cols-[1fr_auto]">
        <div className="border border-zinc-700 p-1.5 text-[11px]"><b>(23) Declared value $</b> {declared ? money(declared) : "____________"} &nbsp; If shipper enters a value, carrier&apos;s &quot;package&quot; liability does not apply and the ad valorem rate will be charged.</div>
        <div className="border border-zinc-700 p-1.5 text-[11px]"><b>(24) Freight payable at</b> {b.freightPayableAt || "____________"} <b className="ml-3">MASTER B/L</b></div>
      </div>
      <p className="mt-2 text-[11px]">The receipt, custody, carriage and delivery of the goods are subject to the terms appearing on the face and back hereof and to carrier&apos;s applicable tariff.</p>
      <div className="mt-3 grid grid-cols-2 gap-6 border border-zinc-700 p-2 text-[11px]">
        <div>In witness whereof original bills of lading all the same tenor and date one of which being accomplished, the others to stand void, have been issued by Carrier or its designated agent on behalf of itself, other participating carriers, the vessel, her master and owners or charterers.</div>
        <div>{COMPANY.name.toUpperCase()}<br />By: ....................................................<br /><span className="mt-2 inline-block">BILL OF LADING NO. <b>{docNo}</b></span><span className="ml-6">DATE <b>{shortDate(b.sailDate)}</b></span></div>
      </div>
    </main>
  );
}
