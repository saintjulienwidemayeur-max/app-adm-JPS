import Link from "next/link";
import { db, effectiveShip, money } from "@/lib/wh-store";
import { createPrealert, cancelPrealert } from "@/lib/wh-actions";
import { HAZARD_FLAGS, itemsTotal } from "@/lib/compliance";
import { nextDeparture, MAX_HOLD_DEPARTURES, departures } from "@/lib/schedule";
import { isoToUs } from "@/lib/clock";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Pre-alerts · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const sel = "h-9 w-full rounded-md border bg-white px-2 text-sm";
const L = ({ label, children, span }: { label: string; children: React.ReactNode; span?: string }) => <label className={`grid gap-1 text-xs font-medium text-zinc-600 ${span ?? ""}`}>{label}{children}</label>;
const tone = (s: string) => (s === "Received" ? "text-green-700" : s === "Cancelled" ? "text-zinc-500" : "text-amber-700");

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams, needle = (q.q ?? "").trim().toLowerCase();
  const rows = db.prealerts.filter((p) => (!q.status || p.status === q.status) && (!needle || [p.id, p.customer, p.tracking, p.carrier, p.vendor].some((v) => v.toLowerCase().includes(needle))));
  const queue = db.items.filter((i) => !i.piece && !i.customer);
  const air = nextDeparture("Air"), sea = nextDeparture("Ocean");
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Pre-alerts</h1>
      <p className="text-sm text-zinc-600">The customer announces an online order before it arrives: the carrier&apos;s final tracking number, what is inside and its value, signed electronically. When the parcel is scanned on Received items it is matched to the customer at once. A parcel nobody announced waits in the review queue.</p>
      <p className="mt-1 text-sm text-zinc-700">Next Air departure <b>{isoToUs(air.departure)}</b> (instructions by {isoToUs(air.cutoff)}) · next Ocean departure <b>{isoToUs(sea.departure)}</b> (instructions by {isoToUs(sea.cutoff)}). Air leaves every Friday, Ocean every Wednesday; instructions are needed 2 business days before. No answer: the parcel goes by Air.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      <section className="mt-4 rounded-lg border p-3">
        <h2 className="font-bold">Review queue: unidentified parcels ({queue.length})</h2>
        {queue.length === 0 ? <p className="mt-1 text-sm text-zinc-600">No unidentified parcel.</p> : (
          <>
            <p className="mt-1 text-xs text-zinc-600">Scanned, but no customer announced them. They stay in the warehouse until the owner is identified: announce the tracking number below (it matches at once) or assign the customer on Consolidate.</p>
            <table className="mt-2 w-full text-left text-sm">
              <thead><tr>{["Date", "Carrier", "Tracking", "Received by"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>{queue.map((i) => <tr key={i.id} className="border-b border-zinc-100"><td className={td}>{i.date}</td><td className={td}>{i.carrier}</td><td className={`${td} font-mono text-xs`}>{i.tracking}</td><td className={td}>{i.receiver || "–"}</td></tr>)}</tbody>
            </table>
            <p className="mt-1 text-xs"><Link href="/warehouse/consolidate" className="text-brand underline">Assign a customer on Consolidate</Link></p>
          </>
        )}
      </section>

      <form action={createPrealert} className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-4">
        <h2 className="font-bold sm:col-span-4">New pre-alert</h2>
        <p className="text-xs text-zinc-600 sm:col-span-4">Everything is asked at once. An order without the carrier&apos;s final tracking number is not stored. The order invoice is preferred; the signed declaration of quantities and values is always required.</p>
        <L label="Customer" span="sm:col-span-2"><Input name="customer" list="cust" placeholder="Name or number" required /></L>
        <datalist id="cust">{db.customers.map((c) => <option key={c.no} value={c.name}>{c.no}</option>)}</datalist>
        <L label="Carrier"><Input name="carrier" list="carriers" placeholder="USPS, UPS, FedEx, SPEEDX..." required /></L>
        <datalist id="carriers">{[...new Set(db.carriers)].map((c) => <option key={c} value={c} />)}</datalist>
        <L label="Final tracking number"><Input name="tracking" placeholder="From the carrier" autoComplete="off" required /></L>
        <L label="Store or seller"><Input name="vendor" placeholder="Amazon, Shein, Temu, eBay..." /></L>
        <L label="Order invoice (number or link)" span="sm:col-span-3"><Input name="invoiceRef" placeholder="Invoice number, file name or link" /></L>
        <div className="sm:col-span-4"><div className="text-xs font-medium text-zinc-600">Items in this order (quantity and value are signed by the customer)</div>
          <div className="mt-1 grid gap-1">{[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_8rem] gap-1">
              <Input name={`d_${i}`} placeholder={`Item ${i + 1}`} maxLength={120} aria-label={`Item ${i + 1}`} />
              <Input name={`q_${i}`} type="number" step="any" min="0" placeholder="Qty" aria-label={`Quantity ${i + 1}`} />
              <Input name={`u_${i}`} type="number" step="0.01" min="0" placeholder="Unit value ($)" className="text-right" aria-label={`Unit value ${i + 1}`} />
            </div>))}</div></div>
        <fieldset className="sm:col-span-4"><legend className="text-xs font-medium text-zinc-600">Does the order contain any of these?</legend>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">{HAZARD_FLAGS.map(([k, label]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" name="hz" value={k} /> {label}</label>)}</div>
        </fieldset>
        <L label="Consignee in Haiti (name)" span="sm:col-span-2"><Input name="consigneeName" placeholder="Customer's consignee" /></L>
        <L label="Consignee phone" span="sm:col-span-2"><Input name="consigneePhone" type="tel" /></L>
        <L label="Shipping method"><select name="choice" className={sel} defaultValue=""><option value="">No answer yet (Air)</option><option value="Air">Air</option><option value="Ocean">Ocean</option></select></L>
        <label className="flex items-end gap-1.5 pb-2 text-sm sm:col-span-3"><input type="checkbox" name="wait" value="yes" /> Wait for other orders before shipping (held up to {MAX_HOLD_DEPARTURES} scheduled shipments)</label>
        <L label="Notes" span="sm:col-span-4"><Input name="notes" /></L>
        <div className="grid gap-2 rounded border border-zinc-300 bg-zinc-50 p-3 sm:col-span-4 sm:grid-cols-[1fr_1fr]">
          <label className="flex items-start gap-1.5 text-sm sm:col-span-2"><input type="checkbox" name="affirm" value="yes" className="mt-1" required /> I affirm that the quantities and values above are true and complete, that the order contains nothing other than what is listed, and that I am responsible for any damage or liability caused by undeclared contents.</label>
          <L label="Electronic signature (full name)"><Input name="signedBy" placeholder="Type the customer's full name" required /></L>
        </div>
        <Button type="submit" className="sm:col-span-4 sm:w-44">Save pre-alert</Button>
      </form>

      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q.q} placeholder="Search customer, tracking or seller" className="w-72" aria-label="Search pre-alerts" />
        <select name="status" defaultValue={q.status ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Status"><option value="">All statuses</option><option>Expected</option><option>Received</option><option>Cancelled</option></select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      {rows.length === 0 ? <p className="mt-4 text-sm text-zinc-600">{db.prealerts.length ? "No pre-alert matches." : "No pre-alerts yet."}</p> : (
        <table className="mt-3 w-full text-left text-sm">
          <thead><tr>{["Pre-alert", "Customer", "Carrier · tracking", "Value", "Method", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((p) => {
            const ship = effectiveShip(p), d = nextDeparture(ship);
            return (
              <tr key={p.id} className="border-b border-zinc-100 align-top">
                <td className={`${td} font-semibold`}>{p.id}<span className="block text-xs font-normal text-zinc-500">{p.created}</span></td>
                <td className={td}>{p.customer}</td>
                <td className={td}>{p.carrier}<span className="block font-mono text-xs">{p.tracking}</span></td>
                <td className={td}>{money(itemsTotal(p.items))}</td>
                <td className={td}>{p.choice ?? "Air (no answer)"}{p.wait && <span className="block text-xs text-amber-700">Waiting for other orders · until {isoToUs(departures(ship, MAX_HOLD_DEPARTURES)[MAX_HOLD_DEPARTURES - 1].departure)} at the latest</span>}{p.status === "Expected" && !p.wait && <span className="block text-xs text-zinc-500">{ship} departs {isoToUs(d.departure)}</span>}</td>
                <td className={`${td} font-medium ${tone(p.status)}`}>{p.status}</td>
                <td className={`${td} space-x-3`}><Link href={`/warehouse/prealerts/${p.id}`} className="text-brand underline">Open</Link>{p.status === "Expected" && <form action={cancelPrealert.bind(null, p.id)} className="inline"><button className="text-red-700 underline">Cancel</button></form>}</td>
              </tr>);
          })}</tbody>
        </table>
      )}
    </main>
  );
}
