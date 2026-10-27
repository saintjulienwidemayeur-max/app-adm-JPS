import Link from "next/link";
import { track, customerMessage } from "@/lib/track";
import { custOf, wrCode } from "@/lib/wh-store";
import { CopyText } from "@/components/copy-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Track a parcel · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const chip = (stage: number) => (stage >= 6 ? "bg-green-100 text-green-800" : stage >= 4 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-900");

// "Where is my parcel?": the customer writes, staff type whatever the customer gave (tracking number, receipt number, name, phone...) and see exactly where it is.
export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = (await searchParams).q ?? "";
  const r = track(q);
  const empty = q.trim().length >= 2 && !r.wrs.length && !r.loose.length && !r.prealerts.length && !r.old.length && !r.customers.length;
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1>Track a parcel</h1>
      <p className="text-sm text-zinc-600">When a customer asks where their parcel is, type what they gave you: the <b>tracking number</b> (or its last digits), the <b>receipt (WR) number</b> (11023 or JPL-11023), the <b>customer name or number</b>, a <b>phone</b>, an <b>e-mail</b>, a piece number or a shipment name.</p>
      <form className="mt-3 flex gap-2"><Input name="q" defaultValue={q} placeholder="Tracking number, WR, name, phone..." aria-label="Search" autoFocus className="max-w-xl" /><Button type="submit">Search</Button></form>

      {empty && <p className="mt-5 rounded-lg border bg-white p-4 text-sm text-zinc-700">Nothing found for &quot;{q}&quot;. Try the last 8 digits of the tracking number, the receipt number without letters, or part of the name. If the parcel has not arrived yet, it is not in the system: ask the customer for the carrier&apos;s tracking number.</p>}

      {r.customers.length > 0 && (
        <p className="mt-4 text-sm text-zinc-600">Customer{r.customers.length > 1 ? "s" : ""}: {r.customers.map((c) => <Link key={c.no} href={`/warehouse/track?q=${c.no}`} className="mr-3 text-brand underline">{c.name} #{c.no}{c.phone ? ` · ${c.phone}` : ""}</Link>)}</p>
      )}
      {r.shipmentHits.length > 0 && <p className="mt-1 text-sm text-zinc-600">Shipment: {r.shipmentHits.map((s) => <Link key={s.name} href={`/warehouse/shipments/${encodeURIComponent(s.name)}`} className="mr-3 text-brand underline">{s.name}{s.shipped ? ` · left ${s.shipped}` : " · open"}</Link>)}</p>}

      {r.wrs.map((t) => {
        const c = custOf(t.w), lang = (c?.lang === "en" || c?.lang === "es" ? c.lang : "fr") as "fr" | "en" | "es";
        return (
          <section key={t.w.id} className="mt-5 rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">{wrCode(t.w)} · {t.w.customer} <span className="text-sm font-normal text-zinc-500">· {t.usa ? "Haiti → Miami" : "Miami → Haiti"} · {t.w.ship}</span></h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${chip(t.stage)}`}>{t.state}</span>
            </div>
            <ol className="mt-3 grid gap-2">
              {t.steps.map((s) => (
                <li key={s.key} className="flex gap-3 text-sm">
                  <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-green-600 text-white" : "bg-zinc-200 text-zinc-500"}`} aria-hidden>{s.done ? "✓" : "·"}</span>
                  <div><div className={s.done ? "font-semibold" : "text-zinc-500"}>{s.label}{s.when && s.done && <span className="ml-2 font-normal text-zinc-600">{s.when}</span>}{s.by && s.done && <span className="ml-2 text-xs font-normal text-zinc-500">by {s.by}</span>}</div>{s.detail && <div className="text-xs text-zinc-600">{s.detail}</div>}</div>
                </li>))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link href={`/warehouse/receipts/${t.w.id}`} className="text-brand underline">Open the receipt</Link>
              <Link href={`/warehouse/receipts/${t.w.id}/report`} className="text-brand underline">View receipt</Link>
              <Link href={`/warehouse/customers/${t.w.cust}`} className="text-brand underline">Customer</Link>
              {t.shipments.map((s) => <Link key={s.name} href={`/warehouse/shipments/${encodeURIComponent(s.name)}`} className="text-brand underline">Shipment {s.name}</Link>)}
            </div>
            <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-brand underline">Message for the customer ({lang === "fr" ? "Français" : lang === "es" ? "Español" : "English"})</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-1">
                <p className="text-xs text-zinc-600">Ready to copy into WhatsApp or an e-mail. It says what the system shows right now.</p>
                <CopyText text={customerMessage(t, lang)} />
                {(["fr", "en", "es"] as const).filter((l) => l !== lang).map((l) => <details key={l}><summary className="cursor-pointer text-xs text-zinc-600 underline">{l === "fr" ? "Français" : l === "en" ? "English" : "Español"}</summary><CopyText text={customerMessage(t, l)} /></details>)}
              </div>
            </details>
          </section>);
      })}
      {r.more > 0 && <p className="mt-3 text-sm text-zinc-600">{r.more} more receipt{r.more > 1 ? "s" : ""}: type something more precise (the tracking number or the receipt number).</p>}

      {r.loose.length > 0 && (
        <section className="mt-5 rounded-lg border bg-white p-4">
          <h2 className="text-base font-bold">Parcels received, not made into a piece yet</h2>
          <ul className="mt-2 grid gap-2 text-sm">{r.loose.map((i) => <li key={i.id}><span className="font-mono text-xs">{i.tracking}</span> · {i.carrier} · received {i.date}{i.by && ` by ${i.by}`}{i.customer ? ` · for ${i.customer}` : " · customer not identified yet"} · <Link href="/warehouse/consolidate" className="text-brand underline">Consolidate</Link></li>)}</ul>
          <p className="mt-2 text-xs text-zinc-600">It is at our warehouse. It leaves after it is consolidated into a piece and loaded on the next shipment.</p>
        </section>
      )}
      {r.prealerts.length > 0 && (
        <section className="mt-5 rounded-lg border bg-white p-4">
          <h2 className="text-base font-bold">Announced by the customer, not received yet</h2>
          <ul className="mt-2 grid gap-1 text-sm">{r.prealerts.map((p) => <li key={p.id}><span className="font-mono text-xs">{p.tracking}</span> · {p.carrier} · {p.customer} · announced {p.created}{p.vendor ? ` · ${p.vendor}` : ""}</li>)}</ul>
          <p className="mt-2 text-xs text-zinc-600">We have not received it yet. Ask the customer to check the carrier&apos;s tracking.</p>
        </section>
      )}
      {r.old.length > 0 && (
        <section className="mt-5 rounded-lg border bg-white p-4">
          <h2 className="text-base font-bold">In the old system (history)</h2>
          <ul className="mt-2 grid gap-1 text-sm">{r.old.map((o) => <li key={o.wr}><Link href={`/warehouse/oldreceipts/${encodeURIComponent(o.wr)}`} className="text-brand underline">Old receipt {o.wr}</Link> · {o.date} · {o.shipper} · {o.why}</li>)}</ul>
        </section>
      )}
    </main>
  );
}
