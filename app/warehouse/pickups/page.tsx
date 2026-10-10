import Link from "next/link";
import { db, PICKUP_STATUSES, pickupPrice, money, wrCode } from "@/lib/wh-store";
import { createPickup } from "@/lib/wh-actions";
import { isoToUs, isoToday } from "@/lib/clock";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Pickups · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const sel = "h-9 w-full rounded-md border bg-white px-2 text-sm";
const L = ({ label, children, span }: { label: string; children: React.ReactNode; span?: string }) => <label className={`grid gap-1 text-xs font-medium text-zinc-600 ${span ?? ""}`}>{label}{children}</label>;
const tone = (s: string) => (s === "Picked up" ? "text-green-700" : s === "Cancelled" ? "text-zinc-500" : "text-amber-700");

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams, needle = (q.q ?? "").trim().toLowerCase();
  const rows = db.pickups.filter((p) => (!q.status || p.status === q.status) && (!needle || [p.id, p.customer, p.address, p.city, p.phone, String(p.cust)].some((v) => v.toLowerCase().includes(needle))));
  const sorted = [...rows].sort((a, b) => Number(a.status !== "Scheduled") - Number(b.status !== "Scheduled") || (a.status === "Scheduled" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Pickups</h1>
      <p className="text-sm text-zinc-600">Prepare a pickup: the driver goes to the customer&apos;s address to collect the parcel. The pickup price is added to the customer&apos;s warehouse receipt as a &quot;Pickup fee&quot; line, so it is already there when the invoice is made.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      <form action={createPickup} className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-4">
        <h2 className="font-bold sm:col-span-4">New pickup</h2>
        <L label="Customer" span="sm:col-span-2"><Input name="customer" list="cust" placeholder="Name or number (a new name is added to Customers)" required /></L>
        <datalist id="cust">{db.customers.map((c) => <option key={c.no} value={c.name}>{c.no}</option>)}</datalist>
        <L label="Contact at the address"><Input name="contact" placeholder="Same as the customer" /></L>
        <L label="Phone"><Input name="phone" type="tel" placeholder="Customer's phone" /></L>
        <L label="Pickup address" span="sm:col-span-2"><Input name="address" placeholder="Street, apt, gate code" required /></L>
        <L label="City"><Input name="city" placeholder="City, state, zip" /></L>
        <L label="Ship type"><select name="ship" className={sel}><option value="Air">Air (JPF)</option><option value="Ocean">Ocean (JPL)</option></select></L>
        <L label="Pickup date"><Input name="date" type="date" defaultValue={isoToday()} required /></L>
        <L label="Time or window"><Input name="time" placeholder="For example 2 PM – 5 PM" maxLength={30} /></L>
        <L label="Pickup price ($)"><Input name="price" type="number" step="0.01" min="0" placeholder="Goes on the receipt" className="text-right" /></L>
        <L label="Driver"><Input name="driver" maxLength={40} /></L>
        <L label="What to collect" span="sm:col-span-2"><Input name="what" placeholder="For example 2 boxes, 1 barrel" maxLength={120} /></L>
        <L label="Notes" span="sm:col-span-2"><Input name="notes" placeholder="Call before arriving, leave at the door..." /></L>
        <Button type="submit" className="sm:col-span-4 sm:w-44">Schedule pickup</Button>
      </form>
      <form method="get" className="mt-3 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q.q} placeholder="Search customer, address or pickup number" className="w-72" aria-label="Search pickups" />
        <select name="status" defaultValue={q.status ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Status"><option value="">All statuses</option>{PICKUP_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      {sorted.length === 0 ? <p className="mt-6 text-sm text-zinc-600">{db.pickups.length ? "No pickup matches." : "No pickups yet."}</p> : (
        <table className="mt-4 w-full text-left text-sm">
          <thead><tr>{["Pickup", "Date", "Customer", "Address", "Price", "Receipt", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map((p) => {
            const w = db.wrs.find((x) => x.id === p.wr);
            return (
              <tr key={p.id} className="border-b border-zinc-100 align-top">
                <td className={`${td} font-semibold`}>{p.id}</td><td className={td}>{isoToUs(p.date)}{p.time && <span className="block text-xs text-zinc-500">{p.time}</span>}</td>
                <td className={td}>{p.customer}</td><td className={td}>{p.address}{p.city && `, ${p.city}`}</td>
                <td className={td}>{money(pickupPrice(p))}</td>
                <td className={td}>{w ? <Link href={`/warehouse/receipts/${w.id}`} className="text-brand underline">{wrCode(w)}</Link> : "–"}</td>
                <td className={`${td} font-medium ${tone(p.status)}`}>{p.status}</td>
                <td className={td}><Link href={`/warehouse/pickups/${p.id}`} className="text-brand underline">Open</Link> <Link href={`/warehouse/pickups/${p.id}/sheet`} className="ml-2 text-brand underline">Sheet</Link></td>
              </tr>);
          })}</tbody>
        </table>
      )}
    </main>
  );
}
