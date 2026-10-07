import Link from "next/link";
import { db, creditOf, balance, total, wrCode, money, r2 } from "@/lib/wh-store";
import { usToIso } from "@/lib/clock";
import { receivePayment } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Receive payment · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const c = db.customers.find((x) => x.no === Number(q.c) || x.name.toLowerCase() === (q.c ?? "").toLowerCase());
  const open = c ? db.wrs.filter((w) => w.cust === c.no && w.fees.length > 0 && balance(w) > 0).sort((a, b) => usToIso(a.date).localeCompare(usToIso(b.date)) || Number(a.id) - Number(b.id)) : [];
  const owed = r2(open.reduce((a, w) => a + balance(w), 0));
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1>Receive a payment</h1>
      <p className="text-sm text-zinc-600">One payment from a customer is spread over their unpaid receipts, oldest first. If it is more than they owe, the rest stays as the customer&apos;s credit.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      <form method="get" className="mt-4 flex gap-2">
        <Input name="c" list="cust" defaultValue={c ? c.name : q.c} placeholder="Customer (name or number)" aria-label="Customer" required />
        <datalist id="cust">{db.customers.map((x) => <option key={x.no} value={x.no}>{x.name}</option>)}</datalist>
        <Button type="submit" variant="outline">Find</Button>
      </form>
      {q.c && !c && <p className="mt-3 text-sm text-red-700">No customer matches &quot;{q.c}&quot;.</p>}
      {c && (
        <section className="mt-5 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{c.name} <span className="text-sm font-normal text-zinc-500">· customer {c.no}</span></h2><Link href={`/warehouse/customers/${c.no}/statement`} className="text-sm text-brand underline">Statement</Link></div>
          <p className="mt-1 text-sm">Owes <b>{money(owed)}</b> on {open.length} receipt{open.length === 1 ? "" : "s"} · credit on file <b>{money(creditOf(c))}</b></p>
          {open.length > 0 && (
            <table className="mt-2 w-full text-left text-sm">
              <thead><tr>{["Date", "Receipt", "Invoice", "Total", "Balance"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>{open.map((w) => <tr key={w.id} className="border-b border-zinc-100"><td className={td}>{w.date}</td><td className={td}><Link href={`/warehouse/receipts/${w.id}`} className="text-brand underline">{wrCode(w)}</Link></td><td className={td}>{w.invoice ?? "–"}</td><td className={td}>{money(total(w))}</td><td className={`${td} font-medium`}>{money(balance(w))}</td></tr>)}</tbody>
            </table>
          )}
          <form action={receivePayment} className="mt-4 grid gap-2 sm:grid-cols-[8rem_12rem_1fr_auto]">
            <input type="hidden" name="cust" value={c.no} />
            <Input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount ($)" aria-label="Amount received" defaultValue={owed > 0 ? owed : undefined} required />
            <Input name="method" list="payMethods" placeholder="Paid by (pick or type new)" aria-label="Paid by" maxLength={30} required />
            <Input name="ref" placeholder="Check # or confirmation" aria-label="Reference" />
            <Button type="submit">Receive payment</Button>
            <datalist id="payMethods">{db.payMethods.map((m) => <option key={m} value={m} />)}</datalist>
          </form>
        </section>
      )}
    </main>
  );
}
