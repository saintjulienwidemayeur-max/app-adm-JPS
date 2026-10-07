import Link from "next/link";
import { db, ORDER_STATUSES, orderTotal, orderPaid, orderBalance, money } from "@/lib/wh-store";
import { createOrder } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Orders · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams, needle = (q.q ?? "").trim().toLowerCase();
  const rows = db.orders.filter((o) => (!q.status || o.status === q.status) && (!needle || o.customer.toLowerCase().includes(needle) || o.id.includes(needle) || String(o.cust) === needle));
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Orders</h1>
      <p className="text-sm text-zinc-600">The customer pays JP&apos;s, then JP&apos;s buys the items and brings them to the Miami warehouse. Make the invoice here, record the payments, and follow the order: Invoiced, Paid, Purchased, In Miami, Closed.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      <form action={createOrder} className="mt-4 flex gap-2 rounded-lg border p-3">
        <Input name="customer" list="cust" placeholder="Customer (name or number; a new name is added to Customers)" required />
        <datalist id="cust">{db.customers.map((c) => <option key={c.no} value={c.name}>{c.no}</option>)}</datalist>
        <Button type="submit">New order</Button>
      </form>
      <form method="get" className="mt-3 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q.q} placeholder="Search customer or order number" className="w-64" aria-label="Search orders" />
        <select name="status" defaultValue={q.status ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Status"><option value="">All statuses</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      {rows.length === 0 ? <p className="mt-6 text-sm text-zinc-600">{db.orders.length ? "No order matches." : "No orders yet."}</p> : (
        <table className="mt-4 w-full text-left text-sm">
          <thead><tr>{["Order", "Date", "Customer", "Status", "Total", "Paid", "Balance", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((o) => (
            <tr key={o.id} className="border-b border-zinc-100">
              <td className={`${td} font-semibold`}>#{o.id}</td><td className={td}>{o.date}</td><td className={td}>{o.customer}</td><td className={td}>{o.status}</td>
              <td className={td}>{money(orderTotal(o))}</td><td className={td}>{money(orderPaid(o))}</td><td className={`${td} font-medium ${orderBalance(o) > 0 ? "text-red-700" : "text-green-700"}`}>{money(orderBalance(o))}</td>
              <td className={`${td} space-x-3`}><Link href={`/warehouse/orders/${o.id}`} className="text-brand underline">Open</Link><Link href={`/warehouse/orders/${o.id}/invoice`} className="text-brand underline">Invoice</Link></td>
            </tr>))}</tbody>
        </table>
      )}
    </main>
  );
}
