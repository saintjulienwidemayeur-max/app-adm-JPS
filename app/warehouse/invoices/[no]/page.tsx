import { notFound } from "next/navigation";
import { db, custOf, repOf, wrCode, total, paidAmt, balance, payStatus, money, insuranceFee, quote, r2 } from "@/lib/wh-store";
import { cardFees } from "@/lib/pricing";
import { shortDate } from "@/lib/fmt";
import { PrintButton } from "@/components/print-button";

const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ params }: { params: Promise<{ no: string }> }) {
  const no = decodeURIComponent((await params).no);
  const w = db.wrs.find((x) => x.invoice === no);
  if (!w) notFound();
  const c = custOf(w), lbs = r2(w.pieces.reduce((a, p) => a + p.lbs, 0));
  const shipment = db.loads.find((l) => l.wr === w.id)?.shipment ?? "";
  // Freight lines say which receipt, weight and pieces they are for, like the old invoice.
  const ref = ` - Ref. WR: ${w.id} - (${lbs} lbs) - Number Of Pieces: ${w.pieces.length}`;
  const lines = [
    ...w.fees.map((f) => ({ desc: f.label + (/freight/i.test(f.label) ? ref : ""), amount: f.kind === "credit" ? -f.amount : f.amount })),
    ...(insuranceFee(w) > 0 ? [{ desc: `Certificate of insurance - Ref. WR: ${w.id} - declared value ${money(w.declared)}`, amount: quote(w).customer }] : []),
  ];
  const card = cardFees(balance(w));
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-16 w-auto" />
        <div className="text-right"><h1 className="!text-2xl">Invoice {w.invoice}</h1><div className="no-print mt-2"><PrintButton /></div></div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
        <div><dt className="text-xs text-zinc-500">Invoice date</dt><dd className="font-medium">{shortDate(w.invoiceDate ?? w.date)}</dd></div>
        <div><dt className="text-xs text-zinc-500">Shipment ID</dt><dd className="font-medium">{shipment || "–"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Receipt</dt><dd className="font-medium">{wrCode(w)}</dd></div>
        <div><dt className="text-xs text-zinc-500">Type</dt><dd>{w.ship}</dd></div>
        <div><dt className="text-xs text-zinc-500">Status</dt><dd>{payStatus(w)}</dd></div>
        <div><dt className="text-xs text-zinc-500">Representative</dt><dd>{repOf(w.rep)?.initials ?? "–"}</dd></div>
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-6">
        <div><div className="text-xs text-zinc-500">Bill To</div><b>{w.customer}</b><div>{c?.billing}</div>{w.email && <div>{w.email}</div>}</div>
        <div><div className="text-xs text-zinc-500">Consignee</div><b>{c?.consignee || w.customer}</b><div>{[c?.consigneeCity, c?.consigneeCountry].filter(Boolean).join(", ")}</div></div>
      </div>
      {w.comments && <p className="mt-3"><b>Notes:</b> {w.comments}</p>}

      <table className="mt-4 w-full text-left">
        <thead className="border-b-2 border-black"><tr><th className={th}>Description</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Amount</th></tr></thead>
        <tbody>{lines.length === 0 ? <tr><td className={`${td} text-zinc-500`} colSpan={4}>No fees on this receipt yet.</td></tr> : lines.map((l, i) => (
          <tr key={i} className="border-b border-zinc-300"><td className={td}>{l.desc}</td><td className={`${td} text-right`}>1.00</td><td className={`${td} text-right`}>{l.amount < 0 ? "−" : ""}{money(Math.abs(l.amount))}</td><td className={`${td} text-right`}>{l.amount < 0 ? "−" : ""}{money(Math.abs(l.amount))}</td></tr>))}</tbody>
      </table>
      <dl className="ml-auto mt-3 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t-2 border-black pt-2">
        <dt className="font-bold">Total</dt><dd className="text-right font-bold">{money(total(w))}</dd>
        <dt>Paid</dt><dd className="text-right">{money(paidAmt(w))}</dd>
        <dt>Balance</dt><dd className="text-right">{money(balance(w))}</dd>
      </dl>
      {balance(w) > 0 && (
        <div className="mt-4 max-w-sm border border-zinc-400 p-2 text-xs">
          <div className="font-semibold">If paying the balance ({money(balance(w))}) by credit card</div>
          <div className="mt-1 grid grid-cols-[1fr_auto_auto] gap-x-4">
            {([["Square CC invoice", card.invoice], ["Pay by credit card, card present", card.present], ["Pay by credit card, manual", card.manual]] as const).map(([label, v]) => (
              <div key={label} className="contents"><span>{label}</span><span className="text-right">{money(v.fee)}</span><b className="text-right">{money(v.total)}</b></div>))}
          </div>
        </div>
      )}
    </main>
  );
}
