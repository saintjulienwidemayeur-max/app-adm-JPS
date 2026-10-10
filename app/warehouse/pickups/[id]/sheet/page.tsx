import { notFound } from "next/navigation";
import { db, wrCode, custOf } from "@/lib/wh-store";
import { isoToUs } from "@/lib/clock";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Driver pickup sheet · JP's Logistics" };
const lbl = "text-xs text-zinc-500";
const line = "mt-1 h-8 border-b border-black";

// One page for the driver: where to go, who to call, what to collect, and a place for the customer to sign.
// The price is not printed: it is billed on the invoice.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const p = db.pickups.find((x) => x.id === id);
  if (!p) notFound();
  const w = db.wrs.find((x) => x.id === p.wr);
  const c = db.customers.find((x) => x.no === p.cust) ?? (w ? custOf(w) : undefined);
  const place = [p.address, p.city].filter(Boolean).join(", ");
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <div className="flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-16 w-auto" />
        <div className="text-right"><div className="font-semibold">{COMPANY.name}</div><div className="text-zinc-600">{COMPANY.phone}</div><div className="no-print mt-2"><PrintButton /></div></div>
      </div>
      <h1 className="mt-2 text-center !text-3xl !text-black">Pickup Sheet</h1>

      <div className="mt-4 flex items-stretch justify-between gap-4">
        <div className="border-2 border-zinc-500 px-4 py-2 text-lg font-bold"><span className="mr-3 text-zinc-500">Pickup</span>{p.id}</div>
        <div className="border-2 border-zinc-500 px-4 py-2 text-right text-lg font-bold">{isoToUs(p.date)}{p.time && <span className="block text-sm font-semibold">{p.time}</span>}</div>
      </div>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div className={lbl}>Pickup address</div>
          <div className="text-lg font-bold">{p.address}</div>
          {p.city && <div className="text-base font-semibold">{p.city}</div>}
          <div className="no-print mt-1"><a href={maps} target="_blank" rel="noreferrer" className="text-brand underline">Open in Google Maps</a></div>
        </div>
        <div>
          <div className={lbl}>Contact at the address</div>
          <div className="text-lg font-bold">{p.contact || p.customer}</div>
          {p.phone && <div className="text-base font-semibold">{p.phone}</div>}
          <div className={`${lbl} mt-2`}>Customer</div>
          <div>{p.customer} <span className="text-zinc-500">(customer {p.cust})</span></div>
          {c?.email && <div className="text-zinc-700">{c.email}</div>}
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><div className={lbl}>Collect</div><div className="font-semibold">{p.what || "–"}</div></div>
        <div><div className={lbl}>Driver</div><div className="font-semibold">{p.driver || "–"}</div></div>
        {w && <div><div className={lbl}>Warehouse receipt</div><div className="font-semibold">{wrCode(w)} · {w.ship}</div></div>}
        {p.notes && <div className="sm:col-span-2"><div className={lbl}>Notes</div><div className="rounded border border-zinc-400 p-2 font-medium">{p.notes}</div></div>}
      </section>

      <section className="mt-6 border-t-2 border-black pt-3">
        <h2 className="font-bold">Filled in by the driver</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <div><div className={lbl}>Number of pieces collected</div><div className={line} /></div>
          <div><div className={lbl}>Arrival time</div><div className={line} /></div>
          <div><div className={lbl}>Departure time</div><div className={line} /></div>
          <div className="sm:col-span-3"><div className={lbl}>Remarks (damage, missing item, customer not home...)</div><div className={line} /><div className={line} /></div>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div><div className={line} /><div className={lbl}>Customer name and signature</div></div>
          <div><div className={line} /><div className={lbl}>Driver signature</div></div>
        </div>
        <p className="mt-4 text-xs text-zinc-600">☐ Parcel(s) match the description &nbsp; ☐ Customer called before arrival &nbsp; ☐ Photo of the parcel(s) taken</p>
      </section>
    </main>
  );
}
