import { notFound } from "next/navigation";
import { db, orderTotal, money, r2 } from "@/lib/wh-store";
import { PrintButton } from "@/components/print-button";

export default async function Page({ params }: { params: Promise<{ id: string; i: string }> }) {
  const { id, i } = await params, n = Number(i);
  const o = db.orders.find((x) => x.id === decodeURIComponent(id)), p = o?.payments[n];
  if (!o || !p) notFound();
  const before = r2(o.payments.slice(0, n).reduce((a, x) => a + x.amount, 0)), balance = r2(orderTotal(o) - before - p.amount);
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 text-sm">
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-16 w-auto" />
        <div className="text-right"><h1 className="!text-2xl">Payment Receipt</h1><div className="text-zinc-600">No. ORD-{o.id}-P{n + 1}</div><div className="no-print mt-2"><PrintButton /></div></div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2">
        <div><dt className="text-xs text-zinc-500">Received from</dt><dd className="font-semibold">{o.customer}</dd></div>
        <div><dt className="text-xs text-zinc-500">Date</dt><dd className="font-semibold">{p.date}{p.time && ` · ${p.time}`}</dd></div>
        <div><dt className="text-xs text-zinc-500">For purchase order</dt><dd>#{o.id}</dd></div>
        <div><dt className="text-xs text-zinc-500">Paid by</dt><dd>{p.method}{p.ref && ` · ${p.ref}`}</dd></div>
      </dl>
      <div className="mt-6 border-2 border-black p-4 text-center"><div className="text-xs text-zinc-500">Amount received</div><div className="text-3xl font-bold">{money(p.amount)}</div></div>
      <dl className="ml-auto mt-5 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1">
        <dt>Total purchasing with delivery to Miami</dt><dd className="text-right">{money(orderTotal(o))}</dd>
        <dt>Paid before</dt><dd className="text-right">{money(before)}</dd>
        <dt>This payment</dt><dd className="text-right">{money(p.amount)}</dd>
        <dt className="border-t-2 border-black pt-1 font-bold">Balance remaining</dt><dd className="border-t-2 border-black pt-1 text-right text-lg font-bold">{money(Math.max(0, balance))}</dd>
      </dl>
      <p className="mt-4 text-center font-medium">{balance <= 0 ? "PAID IN FULL: JP's will now purchase your order." : "PARTIAL PAYMENT: full payment is required before purchasing."}</p>
      <p className="mt-8 text-center text-zinc-600">Thank you for your business · JP&apos;s Logistics &amp; More</p>
    </main>
  );
}
