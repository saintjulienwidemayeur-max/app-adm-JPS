import Link from "next/link";
import { notFound } from "next/navigation";
import { db, balance, total, wrCode, money, r2, creditOf } from "@/lib/wh-store";
import { PrintButton } from "@/components/print-button";

const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ params }: { params: Promise<{ batch: string }> }) {
  const batch = decodeURIComponent((await params).batch);
  const allocs = db.wrs.flatMap((w) => w.payments.filter((p) => p.batch === batch).map((p) => ({ w, p })));
  const credits = db.customers.flatMap((c) => (c.creditLog ?? []).filter((e) => e.batch === batch).map((e) => ({ c, e })));
  const first = allocs[0]?.p ?? credits[0]?.e;
  if (!first) notFound();
  const c = allocs[0] ? db.customers.find((x) => x.no === allocs[0].w.cust) : credits[0].c;
  const applied = r2(allocs.reduce((a, x) => a + x.p.amount, 0)), kept = r2(credits.reduce((a, x) => a + x.e.amount, 0));
  const method = allocs[0]?.p.method ?? credits[0]?.e.method, ref = allocs[0]?.p.ref ?? credits[0]?.e.ref;
  const stillOwed = c ? r2(db.wrs.filter((w) => w.cust === c.no && w.fees.length > 0).reduce((a, w) => a + Math.max(0, balance(w)), 0)) : 0;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 text-sm">
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-16 w-auto" />
        <div className="text-right"><h1 className="!text-2xl">Payment Receipt</h1><div className="text-zinc-600">No. {batch}</div><div className="no-print mt-2"><PrintButton /></div></div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2">
        <div><dt className="text-xs text-zinc-500">Received from</dt><dd className="font-semibold">{c?.name}</dd>{c && <dd className="text-zinc-600">Customer {c.no}</dd>}</div>
        <div><dt className="text-xs text-zinc-500">Date</dt><dd className="font-semibold">{first.date}{first.time && ` · ${first.time}`}</dd></div>
        <div><dt className="text-xs text-zinc-500">Paid by</dt><dd>{method}{ref && ` · ${ref}`}</dd></div>
      </dl>
      <div className="mt-6 border-2 border-black p-4 text-center"><div className="text-xs text-zinc-500">Amount received</div><div className="text-3xl font-bold">{money(r2(applied + kept))}</div></div>
      {allocs.length > 0 && (
        <table className="mt-5 w-full text-left">
          <thead className="border-b-2 border-black"><tr>{["Applied to", "Invoice", "Receipt total", "Paid now", "Balance left"].map((h, i) => <th key={h} className={`${th} ${i > 1 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>{allocs.map(({ w, p }, i) => <tr key={i} className="border-b border-zinc-300"><td className={td}><Link href={`/warehouse/receipts/${w.id}`} className="text-brand underline print:no-underline">{wrCode(w)}</Link></td><td className={td}>{w.invoice ?? "–"}</td><td className={`${td} text-right`}>{money(total(w))}</td><td className={`${td} text-right`}>{money(p.amount)}</td><td className={`${td} text-right`}>{money(Math.max(0, balance(w)))}</td></tr>)}</tbody>
        </table>
      )}
      <dl className="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1">
        <dt>Applied to receipts</dt><dd className="text-right">{money(applied)}</dd>
        {kept > 0 && <><dt>Kept as customer credit</dt><dd className="text-right">{money(kept)}</dd></>}
        <dt className="border-t-2 border-black pt-1 font-bold">Total still owed</dt><dd className="border-t-2 border-black pt-1 text-right text-lg font-bold">{money(stillOwed)}</dd>
        {c && creditOf(c) > 0 && <><dt>Credit on file</dt><dd className="text-right">{money(creditOf(c))}</dd></>}
      </dl>
      <p className="mt-4 text-center font-medium">{stillOwed <= 0 ? "ACCOUNT PAID IN FULL" : "The balance above is still due."}</p>
      <p className="mt-8 text-center text-zinc-600">Thank you for your business · JP&apos;s Logistics &amp; More</p>
    </main>
  );
}
