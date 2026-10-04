import { notFound } from "next/navigation";
import { db, vol, cuft, chargeable, r2, charges, credits, quote, insuranceFee, total, paidAmt, balance, payStatus, money, wrCode, custOf } from "@/lib/wh-store";
import { DISCLAIMER } from "@/lib/disclaimer";
import { cardFees } from "@/lib/pricing";
import { PrintButton } from "@/components/print-button";

const th = "px-2 py-1 font-semibold", td = "px-2 py-1 align-top";
const longDate = (d: string) => { const t = new Date(d); return isNaN(t.getTime()) ? d : t.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = db.wrs.find((x) => x.id === id);
  if (!w) notFound();
  const c = custOf(w);
  const consignee = c?.consignee || w.customer;
  const place = [c?.consigneeCity, c?.consigneeCountry].filter(Boolean).join(", ");
  const phone = c?.consigneePhone || c?.phone;
  const gross = r2(w.pieces.reduce((a, p) => a + p.lbs, 0));
  const cf = r2(w.pieces.reduce((a, p) => a + cuft(p), 0));
  const chg = r2(w.pieces.reduce((a, p) => a + chargeable(p), 0));
  const ins = quote(w);
  const card = cardFees(balance(w));
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-16 w-auto" />
        <div className="text-right"><div className="font-semibold">{longDate(w.date)}</div><div className="no-print mt-2"><PrintButton /></div></div>
      </div>
      <h1 className="mt-2 text-center !text-3xl !text-black">Warehouse Receipt</h1>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
        <div className="space-y-0.5">
          <div><span className="text-zinc-500">Shipper</span> <b>{w.customer}</b> <span className="text-zinc-500">(customer {w.cust})</span></div>
          {c?.billing && <div className="text-zinc-700">{c.billing}</div>}
          <div className="pt-2"><span className="text-zinc-500">Consignee</span> <b>{consignee}</b></div>
          {c?.consigneeAddress && <div>{c.consigneeAddress}</div>}
          {place && <div>{place}</div>}
          {phone && <div><span className="text-zinc-500">Phone</span> {phone}</div>}
          {w.email && <div><span className="text-zinc-500">eMailAddress</span> {w.email}</div>}
        </div>
        <div className="text-right">
          <div className="border-2 border-zinc-500 px-4 py-2 text-lg font-bold"><span className="mr-4 text-zinc-500">WR #</span>{wrCode(w)}</div>
          <div className="mt-1 text-xs text-zinc-500">Ship Type</div><div>{w.ship}</div>
          {w.route && <><div className="mt-1 text-xs text-zinc-500">Route</div><div>{w.route}</div></>}
        </div>
      </div>

      <table className="mt-4 w-full text-left">
        <thead className="border-b-2 border-black"><tr><th className={th}>Item #</th><th className={th}>Descriptions</th><th className={`${th} text-right`}>Weight</th><th className={`${th} text-right`}>CUFT</th><th className={th}>Contents</th></tr></thead>
        <tbody>{w.pieces.map((p, i) => (
          <tr key={p.no} className="border-b border-zinc-300">
            <td className={td}>{p.no}</td>
            <td className={td}>{p.type} - (in) L{p.l} X W{p.w} X H{p.h} - {vol(p)} lbs*</td>
            <td className={`${td} text-right`}>{p.lbs}</td><td className={`${td} text-right`}>{cuft(p)}</td>
            <td className={td}>{i === 0 ? w.contents : ""}</td>
          </tr>))}</tbody>
      </table>

      <div className="mt-4 border-t-2 border-black pt-3">
        <dl className="grid grid-cols-4 gap-4 text-center">
          <div><dt className="font-semibold text-zinc-600">Total Pieces</dt><dd className="text-lg">{w.pieces.length}</dd></div>
          <div><dt className="font-semibold text-zinc-600">Gross Weight</dt><dd className="text-lg">{gross} lbs</dd></div>
          <div><dt className="font-semibold text-zinc-600">Total Cubic ft</dt><dd className="text-lg">{cf} cuft</dd></div>
          <div><dt className="font-semibold text-zinc-600">Total Chargeable</dt><dd className="text-lg font-bold">{chg} lbs</dd></div>
        </dl>
        <div className="mt-3 grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1">
          <b>Declared Contents</b><b>Declared Value <span className="ml-3">{money(w.declared)}</span></b>
          <div className="border border-zinc-300 px-2 py-1">{w.contents || "\u00a0"}</div>
        </div>
      </div>

      <p className="mt-4 text-center font-medium">
        {w.insurance === "Declined" ? "CUSTOMER DECLINED INSURANCE COVERAGE" : w.declared > 0 ? `INSURANCE ACCEPTED · declared value ${money(w.declared)}` : "INSURANCE ACCEPTED (no declared value)"}
      </p>
      {w.comments && <p className="mt-1 text-center"><b>Comments:</b> {w.comments}</p>}

      {(w.fees.length > 0 || insuranceFee(w) > 0) && (
        <table className="ml-auto mt-4 w-full max-w-sm">
          <tbody>
            {w.fees.map((f) => <tr key={f.id}><td className="px-2 py-0.5">{f.label}</td><td className="px-2 py-0.5 text-right">{f.kind === "credit" ? "−" : ""}{money(f.amount)}</td></tr>)}
            {insuranceFee(w) > 0 && <tr><td className="px-2 py-0.5">Certificate of insurance</td><td className="px-2 py-0.5 text-right">{money(ins.customer)}</td></tr>}
          </tbody>
        </table>
      )}
      <dl className="ml-auto mt-2 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t-2 border-black px-2 pt-2">
        {credits(w) > 0 && <><dt>Charges</dt><dd className="text-right">{money(charges(w) + insuranceFee(w))}</dd><dt>Credits</dt><dd className="text-right">−{money(credits(w))}</dd></>}
        <dt className="font-bold">Total</dt><dd className="text-right font-bold">{money(total(w))}</dd>
        <dt>Paid</dt><dd className="text-right">{money(paidAmt(w))}</dd>
        <dt>Balance</dt><dd className="text-right">{money(balance(w))}</dd>
        <dt>Status</dt><dd className="text-right">{payStatus(w)}</dd>
      </dl>

      {balance(w) > 0 && (
        <div className="ml-auto mt-4 max-w-xs border-2 border-black p-2">
          <div className="text-center font-semibold">If Paying with Credit Card</div>
          <div className="flex justify-between"><span>Card Present</span><b>{money(card.present.total)}</b></div>
          <div className="flex justify-between"><span>Pay Online</span><b>{money(card.invoice.total)}</b></div>
        </div>
      )}

      <p className="mt-8 text-center text-xl font-bold text-zinc-700">THANK YOU FOR YOUR BUSINESS</p>
      <h2 className="mt-3 text-center text-lg font-bold text-zinc-700">***** Disclaimer *****</h2>
      <ul className="mt-2 space-y-0.5 text-[11px] leading-snug text-zinc-700">{DISCLAIMER.map((t) => <li key={t}>• {t}</li>)}</ul>
    </main>
  );
}
