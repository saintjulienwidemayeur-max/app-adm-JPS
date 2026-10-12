import { notFound } from "next/navigation";
import { db, openBooking, cargoOf, r2, money, SLI_SERVICES, SLI_PAYMENTS } from "@/lib/wh-store";
import { COMPANY } from "@/lib/company";
import { isoToday } from "@/lib/clock";
import { longDate, shortDate, cm, r1 } from "@/lib/fmt";
import { PrintButton } from "@/components/print-button";

// Shipper's Letter of Instruction, laid out like JP's form SLI (revision 09/09/2024).
const TO_DOOR = "The shipper is required to provide all permits/licenses/visa's, a commercial invoice with actual values and shippers Tax I.D. Number at the time of tendering the shipment to JP's Logistics And More LLC., prior to export. JP's Logistics And More LLC. is not responsible for transportation, customs or delivery delays and/or any additional charges due to incomplete, incorrect or missing documentation or if the shipment is not in proper condition for transportation according to the applicable regulations. Refer to JP's Logistics And More LLC. for country restrictions.";
const RULE_110 = "Rule 110(H): Shipments, the contents of which are liable to deteriorate or perish due to change in the climate, temperature, altitude or other ordinary exposure, or because of length of time in transit, will be accepted without responsibility on the part of carrier for loss or damage due to such deterioration or perishability.";
const NOTE7 = "I/we are hereby certifying that this shipment does not contain Samsung Galaxy Note 7 cellphone. JP's Logistics And More LLC. is not liable for any losses, damages, or seizures of these devices. The shipper will be responsible for any damages and/or liabilities arising from the failure to declare the full content of the shipment(s).";
const TSA = "By signing this form I/we hereby consent to screening this shipment as per Transportation Security Administration (TSA) requirements.";
const bar = "bg-zinc-200 py-0.5 text-center text-xs font-bold";
const cell = "border border-zinc-500 px-2 py-1";
const Box = ({ on }: { on: boolean }) => <span className="mr-1 inline-block size-3.5 border border-black text-center align-middle text-[10px] leading-3">{on ? "X" : ""}</span>;
const Field = ({ label, v, span }: { label: string; v?: string | number; span?: string }) => <div className={`${cell} ${span ?? ""}`}><span className="text-xs text-zinc-500">{label} </span><b>{v || ""}</b></div>;
const YesNo = ({ label, v }: { label: string; v?: string }) => <div className="flex items-center justify-between gap-4 py-0.5"><span>{label}</span><span className="flex gap-6"><span><Box on={v === "YES" || v === "Yes"} />Yes</span><span><Box on={v === "NO" || v === "No"} />No</span></span></div>;

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const sh = db.shipments.find((x) => x.name === name);
  if (!sh) notFound();
  const b = openBooking(sh), c = cargoOf(name), air = sh.ship === "Air";
  const svc = b.services ?? [];
  const rows = c.pallets.map((p) => {
    const info = b.pallets[p] ?? { type: "PALLET", l: 0, w: 0, h: 0 }, mine = c.rows.filter((x) => x.l.pallet === p);
    const lbs = r2(mine.reduce((a, x) => a + x.p.lbs, 0));
    const contents = [...new Set(mine.map((x) => x.p.contents).filter(Boolean))].join("; ") || b.commodity;
    return { qty: mine.length, desc: `${info.type} (${p})${contents ? ` - ${contents}` : ""}`, l: info.l ? cm(info.l) : "", w: info.w ? cm(info.w) : "", h: info.h ? cm(info.h) : "", lbs, kg: r1(lbs * 0.45359) };
  });
  const blank = Math.max(0, 5 - rows.length);
  const declared = b.declared || r2(b.contents.reduce((a, l) => a + l.value, 0));
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-xs">
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-14 w-auto" />
        <h1 className="mt-2 text-center !text-2xl !text-black">Shipper&apos;s Letter of Instruction</h1>
        <div className="text-right"><div className="text-zinc-600">Form SLI/Revision: 09/09/2024</div><div className="no-print mt-2"><PrintButton /></div></div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-x-4 text-xs">
        <div><span className="text-zinc-500">JP&apos;s Shipment ID:</span> <b>{sh.name}</b></div>
        <div><span className="text-zinc-500">{air ? "Flight date:" : "Sailing date:"}</span> <b>{shortDate(b.sailDate)}</b></div>
        <div><span className="text-zinc-500">{air ? "Airline / AWB #:" : "Carrier / Booking #:"}</span> <b>{b.line}{b.awb && ` · ${b.awb}`}</b></div>
      </div>

      <div className="mt-2 border border-zinc-500">
        <div className={bar}>Shipper - Person or Company Tendering Freight</div>
        <div className="grid grid-cols-[2fr_1fr_1fr]"><Field label="Name:" v={b.shipperName} /><Field label="Account:" v={b.shipperAccount} /><Field label="Phone:" v={b.shipperContact} /></div>
        <div className="grid"><Field label="Complete Address:" v={[b.shipperAddress, b.shipperCity].filter(Boolean).join(", ")} /></div>
        <div className="grid grid-cols-[3fr_2fr]"><Field label="Email:" v={b.shipperEmail} /><Field label="Airport of Departure:" v={b.airportDep || (air ? b.origin : "")} /></div>
        <div className={bar}>Consignee - Person or Company Receiving Freight</div>
        <div className="grid grid-cols-[2fr_1fr_1fr]"><Field label="Name:" v={b.consigneeName} /><Field label="Account:" v={b.consigneeAccount} /><Field label="Phone:" v={b.consigneeContact} /></div>
        <div className="grid"><Field label="Complete Address:" v={[b.consigneeAddress, b.consigneeCity].filter(Boolean).join(", ")} /></div>
        <div className="grid grid-cols-[3fr_2fr]"><Field label="Email:" v={b.consigneeEmail} /><Field label="Airport of Arrival:" v={b.airportArr || (air ? b.destination : "")} /></div>

        <div className={bar}>Freight Service - The Shipment(s) will be transported/billed based on the &quot;Freight Service&quot; selected below.</div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-2 py-2 text-[13px]">{SLI_SERVICES.map((s) => <span key={s}><Box on={svc.includes(s)} />{s}</span>)}</div>
        {svc.includes("To Door Delivery") && <p className="px-2 pb-2"><b>To-Door Deliveries:</b> {TO_DOOR}</p>}

        <div className={bar}>Payment Information - How are you paying for the freight charges? (Please check one only)</div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-2 py-2 text-[13px]"><b>PREPAID</b>{SLI_PAYMENTS.map((p) => <span key={p}><Box on={b.payment === p} />{p}</span>)}</div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-zinc-500 px-2 py-2 text-[13px]">
          <span>Would you like to insure this shipment? <Box on={b.insure === "Yes"} />Yes, if Yes, Amount: <b>{b.insure === "Yes" && b.insureAmount ? money(b.insureAmount) : "_____"}</b></span>
          <span><Box on={b.insure === "No"} />No, if denied, initial here: _______</span>
        </div>
        <div className="border-t border-zinc-500 px-2 py-2 text-[13px]">Declared value for customs: <b>{declared ? money(declared) : "__________"}</b></div>
        <div className="border-t border-zinc-500 px-2 py-2 text-[13px]">Do you have a Quote Number or Air Waybill Number? <Box on={b.hasQuote === "Yes"} />Yes <Box on={b.hasQuote === "No"} />No &nbsp; Please list your number: <b>{b.awb}</b></div>
        <div className="border-t border-zinc-500 px-2 py-2 text-[13px]">24 Hour Emergency Contact: Name: <b>{b.emergencyName || "__________"}</b> &nbsp; Contact: <b>{b.emergencyPhone || "__________"}</b></div>

        <div className={bar}>Description of the freight</div>
        <table className="w-full text-left">
          <thead><tr className="border-b border-zinc-500"><th className={`${cell} w-16`}>Quantity</th><th className={cell}>Brief Description</th><th className={cell}>Length (cm)</th><th className={cell}>Width</th><th className={cell}>Height</th><th className={cell}>Weight lb / kg</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td className={cell}>{r.qty}</td><td className={cell}>{r.desc}</td><td className={cell}>{r.l}</td><td className={cell}>{r.w}</td><td className={cell}>{r.h}</td><td className={cell}>{r.lbs} lb / {r.kg} kg</td></tr>)}
            {Array.from({ length: blank }).map((_, i) => <tr key={`b${i}`} className="h-6"><td className={cell} /><td className={cell} /><td className={cell} /><td className={cell} /><td className={cell} /><td className={cell} /></tr>)}
          </tbody>
          <tfoot><tr className="font-bold"><td className={cell}>{c.rows.length ? c.rows.length : ""}</td><td className={cell}>Total</td><td className={cell} colSpan={3}>{c.cuft ? `${c.cuft} cuft` : ""}</td><td className={cell}>{c.lbs ? `${c.lbs} lb / ${r1(c.kg)} kg` : ""}</td></tr></tfoot>
        </table>
        <p className="px-2 py-1 text-[11px]">* If more space for Dimensions is needed, please use the back of the paper.</p>

        <div className="space-y-0.5 border-t border-zinc-500 px-2 py-2 text-[13px]">
          <YesNo label="Refrigeration Required?" v={b.refrigeration} />
          <YesNo label="Do you have a commercial Invoice?" v={b.commercialInvoice ?? "NO"} />
          <YesNo label="Is the freight Hazardous Material? (Example - Paint, Hair Spray, Nail Polish)" v={b.hazmat} />
          <p className="text-[11px] font-bold italic">* All Dangerous Goods/Hazardous material REQUIRE a Shippers Declaration.</p>
          <YesNo label="Does this shipment contain Pharmaceuticals?" v={b.pharma ?? "NO"} />
          <p className="pt-1 text-[13px] font-bold">{TSA}</p>
        </div>
        <div className="min-h-20 border-t border-zinc-500 bg-zinc-100 px-2 py-2 text-[13px]"><span className="text-zinc-600">Special Instructions:</span> {b.special}</div>
        <div className={bar}>PLEASE FILL OUT THIS FORM COMPLETELY!</div>
        <p className="px-2 py-1 text-[9px] leading-tight">{RULE_110}</p>
        <p className="px-2 pb-1 text-[9px] font-bold leading-tight">{NOTE7}</p>
      </div>

      <div className="mt-8 grid grid-cols-[1fr_1fr] gap-8 text-xs">
        <div className="border-t border-black pt-1 text-zinc-600">Signature</div>
        <div className="border-t border-black pt-1 text-zinc-600">Print name: <b className="text-sm text-black">{b.signer}</b></div>
      </div>
      <p className="mt-2 text-right">Date: <b>{longDate(isoToday())}</b> · {COMPANY.phone}</p>
    </main>
  );
}
