import { notFound } from "next/navigation";
import { db, vol, cuft, subtotal, total, paidAmt, balance, payStatus, money } from "@/lib/wh-store";
import { PrintButton } from "@/components/print-button";

type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const estimate = !!(await searchParams).estimate;
  const w = db.wrs.find((x) => x.id === id);
  if (!w) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-16 w-auto" />
        <h1 className="flex-1 text-right">{estimate ? "Estimate" : "Warehouse receipt"}</h1><PrintButton />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div>Receipt <b>JPF-{w.id}</b></div><div>Date <b>{w.date}</b></div>
        <div>Customer <b>{w.customer}</b></div><div>Ship type <b>{w.ship}</b></div>
        {w.route && <div>Route <b>{w.route}</b></div>}{w.declared > 0 && <div>Declared value <b>{money(w.declared)}</b> · insurance {w.insurance.toLowerCase()}</div>}
      </dl>
      <table className="mt-4 w-full text-left text-sm">
        <thead><tr>{["Item", "Type", "L×W×H (in)", "Weight (lb)", "Volume (lb)", "Cuft"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{w.pieces.map((p) => <tr key={p.no} className="border-b border-zinc-100"><td className={td}>{p.no}</td><td className={td}>{p.type}</td><td className={td}>{p.l}×{p.w}×{p.h}</td><td className={td}>{p.lbs}</td><td className={td}>{vol(p)}</td><td className={td}>{cuft(p)}</td></tr>)}</tbody>
      </table>
      <dl className="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        <dt>Subtotal</dt><dd className="text-right">{money(subtotal(w))}</dd>
        <dt>Handling fees</dt><dd className="text-right">{money(w.handling)}</dd>
        <dt>Other fees</dt><dd className="text-right">{money(w.other)}</dd>
        <dt className="font-bold">{estimate ? "Estimated total" : "Total"}</dt><dd className="text-right font-bold">{money(total(w))}</dd>
        {!estimate && <><dt>Paid</dt><dd className="text-right">{money(paidAmt(w))}</dd><dt>Balance</dt><dd className="text-right">{money(balance(w))}</dd><dt>Status</dt><dd className="text-right">{payStatus(w)}</dd></>}
      </dl>
      {w.comments && <p className="mt-4 text-sm"><b>Comments:</b> {w.comments}</p>}
    </main>
  );
}
