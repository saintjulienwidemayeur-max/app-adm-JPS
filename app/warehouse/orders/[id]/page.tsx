import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db, ORDER_STATUSES, orderLine, orderSubtotal, orderFee, orderTotal, orderPaid, orderBalance, orderNotes, money } from "@/lib/wh-store";
import { saveOrder, addOrderItem, saveOrderItems, deleteOrderItem, addOrderPayment, voidOrderPayment } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const sel = "h-9 w-full rounded-md border bg-white px-2 text-sm";
const F = ({ label, children, span }: { label: string; children: ReactNode; span?: string }) => <label className={`grid gap-1 text-xs font-medium text-zinc-600 ${span ?? ""}`}>{label}{children}</label>;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const id = decodeURIComponent((await params).id), q = await searchParams;
  const o = db.orders.find((x) => x.id === id);
  if (!o) notFound();
  const c = db.customers.find((x) => x.no === o.cust);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/warehouse/orders" className="text-sm text-brand underline">All orders</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1>Order #{o.id} · {o.customer} <span className="text-base font-normal text-zinc-600">· {o.status} · {o.date}</span></h1>
        <Link href={`/warehouse/orders/${o.id}/invoice`} className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white">View invoice</Link>
      </div>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}
      <p className="mt-1 text-sm text-zinc-600">Customer {o.cust}{c?.phone && ` · ${c.phone}`}{c?.email && ` · ${c.email}`} · <Link href={`/warehouse/customers/${o.cust}`} className="text-brand underline">details</Link></p>

      <section className="mt-4 rounded-lg border p-3">
        <h2 className="font-bold">Items to buy</h2>
        <datalist id="orderLines"><option value="Taxes and Shipping to Miami Warehouse" /></datalist>
        <form action={saveOrderItems} className="mt-2">
          <input type="hidden" name="order" value={o.id} />
          {o.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead><tr><th className={th}>Description</th><th className={`${th} w-24`}>Quantity</th><th className={`${th} w-32`}>Unit cost ($)</th><th className={`${th} w-28 text-right`}>Total</th><th className={`${th} w-20`} /></tr></thead>
              <tbody>{o.items.map((it, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  <td className={td}><Input name={`d_${i}`} list="orderLines" defaultValue={it.desc} maxLength={120} aria-label={`Description of line ${i + 1}`} required /></td>
                  <td className={td}><Input name={`q_${i}`} type="number" step="any" min="0.01" defaultValue={it.qty} aria-label={`Quantity of line ${i + 1}`} required /></td>
                  <td className={td}><Input name={`u_${i}`} type="number" step="0.01" min="0" defaultValue={it.unit.toFixed(2)} className="text-right" aria-label={`Unit cost of line ${i + 1}`} required /></td>
                  <td className={`${td} text-right`}>{money(orderLine(it))}</td>
                  <td className={td}><button formAction={deleteOrderItem.bind(null, o.id, i)} formNoValidate className="text-red-700 underline" aria-label={`Remove line ${i + 1}`}>Remove</button></td>
                </tr>))}</tbody>
            </table>
          )}
          {o.items.length > 0 && <Button type="submit" className="mt-2">Save lines</Button>}
        </form>
        <form action={addOrderItem} className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-[1fr_6rem_8rem_auto]">
          <input type="hidden" name="order" value={o.id} />
          <Input name="desc" list="orderLines" placeholder="Item (for example Camera EOS R50 kit)" maxLength={120} aria-label="New item" required />
          <Input name="qty" type="number" step="any" min="0.01" defaultValue={1} aria-label="New item quantity" required />
          <Input name="unit" type="number" step="0.01" min="0" placeholder="Unit cost ($)" aria-label="New item unit cost" className="text-right" required />
          <Button type="submit">Add line</Button>
        </form>
        <dl className="mt-4 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt>Subtotal</dt><dd className="text-right">{money(orderSubtotal(o))}</dd>
          <dt>Purchasing fees ({o.feePct}%)</dt><dd className="text-right">{money(orderFee(o))}</dd>
          <dt className="font-bold">Total with delivery to Miami</dt><dd className="text-right font-bold">{money(orderTotal(o))}</dd>
          <dt>Paid</dt><dd className="text-right">{money(orderPaid(o))}</dd>
          <dt>Balance</dt><dd className="text-right">{money(orderBalance(o))}</dd>
        </dl>
      </section>

      <section className="mt-5 rounded-lg border p-3">
        <h2 className="font-bold">Payments</h2>
        <p className="text-xs text-zinc-600">Full payment is required before JP&apos;s buys the order.</p>
        {o.payments.length > 0 && (
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr>{["Date", "Method", "Reference", "Amount", "", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>{o.payments.map((p, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className={td}>{p.date}{p.time && ` ${p.time}`}</td><td className={td}>{p.method}</td><td className={td}>{p.ref || "–"}</td><td className={td}>{money(p.amount)}</td>
                <td className={td}><Link href={`/warehouse/orders/${o.id}/payments/${i}`} className="text-brand underline">Payment receipt</Link></td>
                <td className={td}><form><button formAction={voidOrderPayment.bind(null, o.id, i)} className="text-red-700 underline" aria-label={`Void order payment ${i + 1}`}>Void</button></form></td>
              </tr>))}</tbody>
          </table>
        )}
        {orderBalance(o) > 0 && (
          <form action={addOrderPayment} className="mt-3 grid gap-2 sm:grid-cols-[8rem_11rem_1fr_auto]">
            <input type="hidden" name="order" value={o.id} />
            <Input name="amount" type="number" step="0.01" min="0.01" max={orderBalance(o)} defaultValue={orderBalance(o)} aria-label="Order payment amount" required />
            <Input name="method" list="payMethods" placeholder="Paid by (pick or type new)" aria-label="Order payment method" maxLength={30} required />
            <Input name="ref" placeholder="Check # or confirmation" aria-label="Order payment reference" />
            <Button type="submit">Add payment</Button>
            <datalist id="payMethods">{db.payMethods.map((m) => <option key={m} value={m} />)}</datalist>
          </form>
        )}
      </section>

      <section className="mt-5 rounded-lg border p-3">
        <h2 className="font-bold">Follow the order</h2>
        <form action={saveOrder} className="mt-2 grid gap-2 sm:grid-cols-4">
          <input type="hidden" name="order" value={o.id} />
          <F label="Status"><select name="status" defaultValue={o.status} className={sel}>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></F>
          <F label="Purchasing fee (%)"><Input name="feePct" type="number" step="0.01" min="0" max="100" defaultValue={o.feePct} /></F>
          <F label="Representative"><select name="rep" defaultValue={o.rep} className={sel}><option value="">None</option>{db.reps.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.initials})</option>)}</select></F>
          <F label="Order / tracking number from the store"><Input name="tracking" defaultValue={o.tracking} /></F>
          <F label="Notes printed on the invoice (empty = the standard text)" span="sm:col-span-4"><Input name="notes" defaultValue={o.notes} placeholder={orderNotes({ ...o, notes: "" }).slice(0, 90) + "…"} /></F>
          <Button type="submit" className="sm:col-span-4 sm:w-40">Save order</Button>
        </form>
      </section>
    </main>
  );
}
