import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db, pickupPrice, pickupFeeLine, money, wrCode, total } from "@/lib/wh-store";
import { savePickup, setPickupStatus } from "@/lib/wh-actions";
import { isoToUs } from "@/lib/clock";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SP = Promise<Record<string, string | undefined>>;
const L = ({ label, children, span }: { label: string; children: ReactNode; span?: string }) => <label className={`grid gap-1 text-xs font-medium text-zinc-600 ${span ?? ""}`}>{label}{children}</label>;
const btn = "inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-100";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const id = decodeURIComponent((await params).id), q = await searchParams;
  const p = db.pickups.find((x) => x.id === id);
  if (!p) notFound();
  const w = db.wrs.find((x) => x.id === p.wr);
  const locked = !!w?.invoice;
  const onReceipt = !!pickupFeeLine(p);
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/warehouse/pickups" className="text-sm text-brand underline">All pickups</Link>
      <h1 className="mt-1">Pickup {p.id} · {p.customer} <span className="text-base font-normal text-zinc-600">· {p.status} · {isoToUs(p.date)}{p.time && ` · ${p.time}`}</span></h1>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}
      <div className="mt-2"><Link href={`/warehouse/pickups/${p.id}/sheet`} className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white">Print driver sheet</Link></div>
      <p className="mt-1 text-sm text-zinc-600">Customer {p.cust} · <Link href={`/warehouse/customers/${p.cust}`} className="text-brand underline">details</Link></p>

      <section className="mt-4 rounded-lg border p-3">
        <h2 className="font-bold">Price on the warehouse receipt</h2>
        {w ? (
          <p className="mt-1 text-sm">
            {p.status === "Cancelled" ? "Cancelled: no pickup fee on the receipt." : onReceipt ? <>Pickup fee <b>{money(pickupPrice(p))}</b> is on receipt </> : "No pickup fee (price 0). Receipt "}
            <Link href={`/warehouse/receipts/${w.id}`} className="font-semibold text-brand underline">{wrCode(w)}</Link>
            {" "}· receipt total {money(total(w))}
            {w.invoice ? <> · invoiced as <Link href={`/warehouse/invoices/${w.invoice}`} className="text-brand underline">{w.invoice}</Link></> : " · not invoiced yet: the fee will be on the invoice."}
          </p>
        ) : <p className="mt-1 text-sm text-red-700">The receipt of this pickup no longer exists.</p>}
        {locked && <p className="mt-1 text-xs text-zinc-600">The receipt is invoiced, so the price is locked. Cancel the invoice on the receipt to change it.</p>}
      </section>

      <section className="mt-4 rounded-lg border p-3">
        <h2 className="font-bold">Details</h2>
        <form action={savePickup} className="mt-2 grid gap-2 sm:grid-cols-4">
          <input type="hidden" name="pickup" value={p.id} />
          <L label="Contact at the address" span="sm:col-span-2"><Input name="contact" defaultValue={p.contact} /></L>
          <L label="Phone" span="sm:col-span-2"><Input name="phone" type="tel" defaultValue={p.phone} /></L>
          <L label="Pickup address" span="sm:col-span-3"><Input name="address" defaultValue={p.address} required /></L>
          <L label="City"><Input name="city" defaultValue={p.city} /></L>
          <L label="Pickup date"><Input name="date" type="date" defaultValue={p.date} required /></L>
          <L label="Time or window"><Input name="time" defaultValue={p.time} maxLength={30} /></L>
          <L label="Pickup price ($)"><Input name="price" type="number" step="0.01" min="0" defaultValue={(p.status === "Cancelled" ? p.price : pickupPrice(p)).toFixed(2)} readOnly={locked} className="text-right" /></L>
          <L label="Driver"><Input name="driver" defaultValue={p.driver} maxLength={40} /></L>
          <L label="What to collect" span="sm:col-span-4"><Input name="what" defaultValue={p.what} maxLength={120} /></L>
          <L label="Notes" span="sm:col-span-4"><Input name="notes" defaultValue={p.notes} /></L>
          <Button type="submit" className="sm:col-span-4 sm:w-40">Save pickup</Button>
        </form>
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <h2 className="mr-2 font-bold">Status</h2>
        {p.status === "Scheduled" && <form action={setPickupStatus.bind(null, p.id, "Picked up")}><Button type="submit">Mark as picked up</Button></form>}
        {p.status === "Scheduled" && <form action={setPickupStatus.bind(null, p.id, "Cancelled")}><button className={`${btn} !text-red-700`}>Cancel pickup (removes the fee)</button></form>}
        {p.status === "Picked up" && <form action={setPickupStatus.bind(null, p.id, "Scheduled")}><button className={btn}>Back to scheduled</button></form>}
        {p.status === "Cancelled" && <form action={setPickupStatus.bind(null, p.id, "Scheduled")}><button className={btn}>Schedule again (adds the fee back)</button></form>}
        {p.status === "Picked up" && w && <Link href={`/warehouse/receipts/${w.id}`} className="text-sm text-brand underline">Add the pieces to receipt {wrCode(w)}</Link>}
      </section>
    </main>
  );
}
