import Link from "next/link";
import { notFound } from "next/navigation";
import { db, wrCode, total, paidAmt, balance, money, r2, creditOf } from "@/lib/wh-store";
import { usToday, daysSince } from "@/lib/clock";
import { PrintButton } from "@/components/print-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
type SP = Promise<Record<string, string | undefined>>;
const key = (us: string) => { const [m, d, y] = us.split("/"); return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; };

export default async function Page({ params, searchParams }: { params: Promise<{ no: string }>; searchParams: SP }) {
  const { no } = await params, q = await searchParams;
  const c = db.customers.find((x) => x.no === Number(no));
  if (!c) notFound();
  const rows = db.wrs.filter((w) => w.cust === c.no && (w.fees.length > 0 || w.payments.length > 0) && (!q.from || key(w.date) >= q.from) && (!q.to || key(w.date) <= q.to) && (q.show !== "open" || balance(w) > 0))
    .sort((a, b) => key(a.date).localeCompare(key(b.date)) || Number(a.id) - Number(b.id));
  const billed = r2(rows.reduce((a, w) => a + total(w), 0)), paid = r2(rows.reduce((a, w) => a + paidAmt(w), 0));
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 text-sm">
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-16 w-auto" />
        <div className="text-right"><h1 className="!text-2xl">Statement</h1><div className="text-zinc-600">as of {usToday()}</div><div className="no-print mt-2"><PrintButton /></div></div>
      </div>
      <div className="mt-3"><b>{c.name}</b> <span className="text-zinc-500">· customer {c.no}</span><div>{c.billing}</div><div>{[c.phone, c.email].filter(Boolean).join(" · ")}</div></div>
      <form method="get" className="no-print mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-zinc-600">From <Input name="from" type="date" defaultValue={q.from} className="w-40" /></label>
        <label className="text-xs text-zinc-600">To <Input name="to" type="date" defaultValue={q.to} className="w-40" /></label>
        <select name="show" defaultValue={q.show ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm"><option value="">All receipts</option><option value="open">Only with a balance</option></select>
        <Button type="submit" variant="outline">Filter</Button>
        <Link href={`/warehouse/customers/${c.no}`} className="text-brand underline">Back to customer</Link>
      </form>
      {rows.length === 0 ? <p className="mt-6 text-zinc-600">Nothing to show.</p> : (
        <table className="mt-4 w-full text-left">
          <thead className="border-b-2 border-black"><tr>{["Date", "Receipt", "Invoice", "Total", "Paid", "Balance"].map((h, i) => <th key={h} className={`${th} ${i > 2 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>{rows.flatMap((w) => [
            <tr key={w.id} className="border-t border-zinc-300"><td className={td}>{w.date}</td><td className={td}>{wrCode(w)}</td><td className={td}>{w.invoice ?? "–"}</td><td className={`${td} text-right`}>{money(total(w))}</td><td className={`${td} text-right`}>{money(paidAmt(w))}</td><td className={`${td} text-right font-medium`}>{money(balance(w))}</td></tr>,
            ...w.payments.map((p, i) => <tr key={`${w.id}-${i}`} className="text-xs text-zinc-600"><td className={`${td} pl-6`}>{p.date}</td><td className={td} colSpan={2}>Payment: {p.method}{p.ref && ` · ${p.ref}`}</td><td className={td} /><td className={`${td} text-right`}>{money(p.amount)}</td><td className={td} /></tr>),
          ])}</tbody>
          <tfoot><tr className="border-t-2 border-black font-bold"><td className={td} colSpan={3}>Total ({rows.length} receipt{rows.length === 1 ? "" : "s"})</td><td className={`${td} text-right`}>{money(billed)}</td><td className={`${td} text-right`}>{money(paid)}</td><td className={`${td} text-right`}>{money(r2(billed - paid))}</td></tr></tfoot>
        </table>
      )}
      <p className="mt-4 text-right text-lg font-bold">Balance due: {money(r2(billed - paid))}</p>
      {creditOf(c) > 0 && <p className="text-right">Credit on file: <b>{money(creditOf(c))}</b></p>}
      <table className="mt-4 ml-auto text-xs"><thead><tr>{["0-30 days", "31-60", "61-90", "Over 90"].map((h) => <th key={h} className="px-3 py-1 text-right font-semibold text-zinc-600">{h}</th>)}</tr></thead>
        <tbody><tr>{([[0, 30], [31, 60], [61, 90], [91, 99999]] as const).map(([lo, hi]) => <td key={lo} className="px-3 py-1 text-right">{money(r2(rows.filter((w) => { const d = daysSince(w.date); return d >= lo && d <= hi && balance(w) > 0; }).reduce((a, w) => a + balance(w), 0)))}</td>)}</tr></tbody></table>
    </main>
  );
}
