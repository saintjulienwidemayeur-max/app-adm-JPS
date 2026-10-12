import Link from "next/link";
import { notFound } from "next/navigation";
import { db, effectiveShip, money } from "@/lib/wh-store";
import { savePrealert } from "@/lib/wh-actions";
import { HAZARD_FLAGS, itemsTotal, lineTotal, reviewFlags } from "@/lib/compliance";
import { nextDeparture, departures, MAX_HOLD_DEPARTURES } from "@/lib/schedule";
import { isoToUs } from "@/lib/clock";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const sel = "h-9 w-full rounded-md border bg-white px-2 text-sm";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const id = decodeURIComponent((await params).id), q = await searchParams;
  const p = db.prealerts.find((x) => x.id === id);
  if (!p) notFound();
  const ship = effectiveShip(p), d = nextDeparture(ship), last = departures(ship, MAX_HOLD_DEPARTURES)[MAX_HOLD_DEPARTURES - 1];
  const flags = reviewFlags(p);
  const item = db.items.find((i) => i.id === p.itemId);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <Link href="/warehouse/prealerts" className="no-print text-brand underline">All pre-alerts</Link>
      <div className="mt-1 flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="h-14 w-auto" />
        <div className="text-right"><div className="font-semibold">{COMPANY.name}</div><div className="no-print mt-2"><PrintButton /></div></div>
      </div>
      <h1 className="mt-2 text-center !text-2xl !text-black">Shipper&apos;s Declaration of Contents · {p.id}</h1>
      {q.err && <p role="alert" className="no-print mt-2 font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="no-print mt-2 font-medium text-green-700">{q.ok}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        <div><dt className="text-xs text-zinc-500">Customer</dt><dd className="font-medium">{p.customer} <span className="text-zinc-500">({p.cust})</span></dd></div>
        <div><dt className="text-xs text-zinc-500">Carrier</dt><dd className="font-medium">{p.carrier}</dd></div>
        <div><dt className="text-xs text-zinc-500">Final tracking number</dt><dd className="font-mono font-medium">{p.tracking}</dd></div>
        <div><dt className="text-xs text-zinc-500">Store or seller</dt><dd>{p.vendor || "–"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Order invoice</dt><dd>{p.invoiceRef || "–"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Status</dt><dd className="font-medium">{p.status}{item && <> · received {item.date}</>}</dd></div>
        <div><dt className="text-xs text-zinc-500">Consignee</dt><dd>{p.consigneeName || "–"}{p.consigneePhone && ` · ${p.consigneePhone}`}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-zinc-500">Shipping</dt><dd>{p.choice ?? "Air (no answer yet)"}{p.wait ? ` · waiting for other orders, held until ${isoToUs(last.departure)} at the latest` : p.status === "Expected" ? ` · next ${ship} departure ${isoToUs(d.departure)}, instructions by ${isoToUs(d.cutoff)}` : ""}</dd></div>
      </dl>

      <table className="mt-4 w-full text-left">
        <thead className="border-b-2 border-black"><tr><th className={th}>Item</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Unit value</th><th className={`${th} text-right`}>Total</th></tr></thead>
        <tbody>{p.items.map((i, k) => <tr key={k} className="border-b border-zinc-300"><td className={td}>{i.desc}</td><td className={`${td} text-right`}>{i.qty}</td><td className={`${td} text-right`}>{money(i.unit)}</td><td className={`${td} text-right`}>{money(lineTotal(i))}</td></tr>)}</tbody>
        <tfoot><tr className="border-t-2 border-black font-bold"><td className={td} colSpan={3}>Total declared value</td><td className={`${td} text-right`}>{money(itemsTotal(p.items))}</td></tr></tfoot>
      </table>
      <p className="mt-3">Restricted items declared: <b>{p.hazards.length ? p.hazards.map((h) => HAZARD_FLAGS.find(([k]) => k === h)?.[1]).join("; ") : "None"}</b></p>
      {p.notes && <p className="mt-1"><b>Notes:</b> {p.notes}</p>}
      <p className="mt-4 text-xs text-zinc-700">I affirm that the quantities and values above are true and complete, that the order contains nothing other than what is listed, and that I am responsible for any damage or liability caused by undeclared contents.</p>
      <p className="mt-2">Electronically signed by <b>{p.signedBy}</b> on {p.signedAt}</p>

      {flags.length > 0 && (
        <section className="no-print mt-5 rounded-lg border border-amber-400 bg-amber-50 p-3">
          <h2 className="font-bold text-amber-800">To check before shipping</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-900">{flags.map((f) => <li key={f}>{f}</li>)}</ul>
        </section>
      )}

      <section className="no-print mt-5 rounded-lg border p-3">
        <h2 className="font-bold">Customer instructions</h2>
        <p className="text-xs text-zinc-600">Instructions are needed 2 business days before the departure (Air: Friday, Ocean: Wednesday). Later requests go with the next shipment.</p>
        <form action={savePrealert} className="mt-2 grid gap-2 sm:grid-cols-3">
          <input type="hidden" name="id" value={p.id} />
          <label className="grid gap-1 text-xs font-medium text-zinc-600">Shipping method<select name="choice" defaultValue={p.choice ?? ""} className={sel}><option value="">No answer yet (Air)</option><option value="Air">Air</option><option value="Ocean">Ocean</option></select></label>
          <label className="flex items-end gap-1.5 pb-2 text-sm sm:col-span-2"><input type="checkbox" name="wait" value="yes" defaultChecked={p.wait} /> Wait for other orders (held up to {MAX_HOLD_DEPARTURES} scheduled shipments)</label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600 sm:col-span-3">Order invoice (number or link)<Input name="invoiceRef" defaultValue={p.invoiceRef} /></label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600 sm:col-span-3">Notes<Input name="notes" defaultValue={p.notes} /></label>
          <Button type="submit" className="sm:w-40">Save</Button>
        </form>
      </section>
    </main>
  );
}
