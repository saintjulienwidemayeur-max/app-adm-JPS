import { notFound } from "next/navigation";
import { db, orderLine, orderSubtotal, orderFee, orderTotal, orderPaid, orderBalance, orderNotes, money } from "@/lib/wh-store";
import { HAITI } from "@/lib/company";
import { ordinalDate } from "@/lib/fmt";
import { PrintButton } from "@/components/print-button";

const cell = "border border-zinc-700 px-2 py-1.5";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const o = db.orders.find((x) => x.id === id);
  if (!o) notFound();
  const c = db.customers.find((x) => x.no === o.cust);
  const country = c?.consigneeCountry || "Haiti", paid = orderPaid(o), bal = orderBalance(o);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <div className="no-print mb-2 flex justify-end"><PrintButton /></div>
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="mx-auto h-24 w-auto" />
        <div className="mt-1 text-xs font-semibold text-brand">{HAITI.address}, {HAITI.city}</div>
      </div>
      <div className="mt-8 flex items-end justify-between">
        <div><h1 className="!text-4xl !text-zinc-800">INVOICE</h1><div className="font-semibold">#{o.id}</div></div>
        <div className="pb-1">{ordinalDate(o.date)}</div>
      </div>
      <div className="mt-6 font-semibold">{o.customer}<div className="font-normal">{country}</div></div>

      <table className="mt-5 w-full border-collapse text-center">
        <thead><tr><th className={`${cell} w-1/2`}>Description</th><th className={cell}>Quantity</th><th className={cell}>Unit Cost</th><th className={cell}>Total</th></tr></thead>
        <tbody>{o.items.map((it, i) => (
          <tr key={i}><td className={`${cell} text-left`}>{it.desc}</td><td className={cell}>{it.qty}</td><td className={`${cell} text-right`}>{money(it.unit)}</td><td className={`${cell} text-right`}>{money(orderLine(it))}</td></tr>))}
          {o.items.length === 0 && <tr><td className={`${cell} text-left text-zinc-500`} colSpan={4}>No items yet.</td></tr>}
        </tbody>
        <tfoot>
          <tr><td /><td /><td className={`${cell} text-left`}>Subtotal</td><td className={`${cell} text-right`}>{money(orderSubtotal(o))}</td></tr>
          <tr><td /><td /><td className={`${cell} text-left`}>Purchasing Fees ({o.feePct}%)</td><td className={`${cell} text-right`}>{money(orderFee(o))}</td></tr>
          <tr><td /><td /><td className={`${cell} text-left font-semibold`}>Total purchasing with delivery to Miami {bal > 0 && paid === 0 ? "now due" : ""}</td><td className={`${cell} text-right font-semibold`}>{money(orderTotal(o))}</td></tr>
          {paid > 0 && <tr><td /><td /><td className={`${cell} text-left`}>Paid</td><td className={`${cell} text-right`}>{money(paid)}</td></tr>}
          {paid > 0 && <tr><td /><td /><td className={`${cell} text-left font-semibold`}>{bal > 0 ? "Balance now due" : "PAID IN FULL"}</td><td className={`${cell} text-right font-semibold`}>{money(Math.max(0, bal))}</td></tr>}
        </tfoot>
      </table>
      <p className="mt-5 text-[13px] italic leading-snug text-zinc-700">{orderNotes(o)}</p>
    </main>
  );
}
