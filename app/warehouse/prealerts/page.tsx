import Link from "next/link";
import { db, effectiveShip, money } from "@/lib/wh-store";
import { importSitePrealerts, cancelPrealert } from "@/lib/wh-actions";
import { itemsTotal } from "@/lib/compliance";
import { nextDeparture, MAX_HOLD_DEPARTURES, departures } from "@/lib/schedule";
import { isoToUs } from "@/lib/clock";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Pre-alerts · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const tone = (s: string) => (s === "Received" ? "text-green-700" : s === "Cancelled" ? "text-zinc-500" : "text-amber-700");

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams, needle = (q.q ?? "").trim().toLowerCase();
  const rows = db.prealerts.filter((p) => (!q.status || p.status === q.status) && (!needle || [p.id, p.customer, p.tracking, p.carrier, p.vendor].some((v) => v.toLowerCase().includes(needle))));
  const queue = db.items.filter((i) => !i.piece && !i.customer);
  const air = nextDeparture("Air"), sea = nextDeparture("Ocean");
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Pre-alerts</h1>
      <p className="text-sm text-zinc-600">The customer announces an online order before it arrives (on the customer website). When the parcel is scanned on Received items it is matched to the customer at once. A parcel nobody announced waits in the review queue.</p>
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

      <section className="mt-4 rounded-lg border p-3">
        <h2 className="font-bold">Announced by customers on the website</h2>
        <p className="mt-1 text-xs text-zinc-600">The pre-alert form is on the customer website, in the customer&apos;s own area (carrier, final tracking number, store, contents, value, Air or Ocean). Nothing is entered here. When a tracking number is scanned on Received items, the website is checked too. Press the button to bring in everything announced so far.</p>
        <form action={importSitePrealerts} className="mt-2"><Button type="submit" variant="outline">Check the website now</Button></form>
      </section>

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
