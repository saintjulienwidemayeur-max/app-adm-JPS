import Link from "next/link";
import { notFound } from "next/navigation";
import { db, money, oldApplied, oldBalance, oldOpen } from "@/lib/wh-store";
import { shortDate } from "@/lib/fmt";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
const th = "px-2 py-1 font-semibold", td = "px-2 py-1 align-top";

export default async function Page({ params }: { params: Promise<{ no: string }> }) {
  const no = decodeURIComponent((await params).no);
  const o = db.oldInvoices.find((x) => x.no === no);
  if (!o) notFound();
  const c = db.customers.find((x) => x.no === o.cust), consignee = o.consignee && o.consignee !== o.cust ? db.customers.find((x) => x.no === o.consignee) : undefined;
  const sum = o.lines.reduce((a, l) => a + l.a, 0);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <div className="no-print mb-3 flex items-center justify-between"><Link href="/warehouse/oldinvoices" className="text-brand underline">← All old invoices</Link><PrintButton /></div>
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-16 w-auto" />
        <div className="text-right"><h1 className="!text-2xl">Invoice {o.no}</h1><div className="text-xs text-zinc-500">From the old billing system</div></div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <div><dt className="text-xs text-zinc-500">Date</dt><dd className="font-medium">{shortDate(o.date)}</dd></div>
        <div><dt className="text-xs text-zinc-500">Shipment</dt><dd className="font-medium">{o.shipment || "–"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Type</dt><dd>{o.ship || "–"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Status</dt><dd className={`font-semibold ${oldOpen(o) ? "text-red-700" : "text-green-700"}`}>{oldOpen(o) ? "Open" : "Paid"}</dd></div>
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-6">
        <div><div className="text-xs text-zinc-500">Bill To</div><b>{c?.name ?? `Customer ${o.cust}`}</b><div className="text-zinc-600">Customer {o.cust}{c?.phone && ` · ${c.phone}`}</div></div>
        <div><div className="text-xs text-zinc-500">Consignee</div><b>{consignee?.name ?? c?.consignee ?? c?.name ?? "–"}</b></div>
      </div>
      <table className="mt-4 w-full text-left">
        <thead className="border-b-2 border-black"><tr><th className={th}>Description</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Amount</th></tr></thead>
        <tbody>{o.lines.length === 0 ? <tr><td className={`${td} text-zinc-500`} colSpan={4}>No lines in the old system.</td></tr> : o.lines.map((l, i) => (
          <tr key={i} className="border-b border-zinc-300"><td className={td}>{l.d}</td><td className={`${td} text-right`}>{l.q}</td><td className={`${td} text-right`}>{money(l.u)}</td><td className={`${td} text-right`}>{money(l.a)}</td></tr>))}</tbody>
      </table>
      <dl className="ml-auto mt-3 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t-2 border-black pt-2">
        <dt className="font-bold">Total</dt><dd className="text-right font-bold">{money(o.total)}</dd>
        <dt>Payments applied</dt><dd className="text-right">{money(oldApplied(o))}</dd>
        <dt className="font-semibold">Balance</dt><dd className={`text-right font-semibold ${oldOpen(o) ? "text-red-700" : ""}`}>{money(oldBalance(o))}</dd>
      </dl>
      {Math.abs(sum - o.total) > 0.02 && o.lines.length > 0 && <p className="mt-1 text-right text-xs text-amber-700">The lines add up to {money(sum)}; the old system&apos;s total is {money(o.total)}.</p>}
      {o.pays.length > 0 && (
        <div className="mt-4 text-xs"><div className="font-semibold">Payments applied</div>
          {o.pays.map((p, i) => <div key={i} className="flex justify-between border-b border-zinc-200 py-0.5"><span>{p.date ? shortDate(p.date) : "–"} · {p.method || "payment"} · #{p.id}</span><span>{money(p.amount)}</span></div>)}
        </div>
      )}
      {o.paid && oldApplied(o) + 0.01 < o.total && <p className="mt-3 text-xs text-zinc-600">The old system marks this invoice as paid ({o.method || "paid"}) although the payments applied are less than the total.</p>}
    </main>
  );
}
