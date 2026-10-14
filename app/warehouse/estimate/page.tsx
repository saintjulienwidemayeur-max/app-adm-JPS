import type { ReactNode } from "react";
import { money } from "@/lib/wh-store";
import { cardFees } from "@/lib/pricing";
import { ESTIMATE_NOTE } from "@/lib/disclaimer";
import { estimate, parseEstimate, EST_MAX_ROWS, EST_AIR_RATE, EST_OCEAN_RATE, EST_AIR_HANDLING, EST_OCEAN_HANDLING } from "@/lib/estimate";
import { estimateToReceipt } from "@/lib/wh-actions";
import { db } from "@/lib/wh-store";
import { usToday } from "@/lib/clock";
import { AutoForm } from "@/components/auto-form";
import { PrintButton } from "@/components/print-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Estimate · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const F = ({ label, children, span }: { label: string; children: ReactNode; span?: string }) => <label className={`grid gap-1 text-xs font-medium text-zinc-600 ${span ?? ""}`}>{label}{children}</label>;
const KEYS = ["customer", "rateAir", "rateOcean", "handlingAir", "handlingOcean", "declared", "insure", "pickup", "repack", "otherLabel", "other", "credit"];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const get = (k: string) => q[k];
  const inp = parseEstimate(get);
  const est = estimate(inp);
  // Rows shown: at least 5, and always one empty row after the last one in use.
  let last = -1;
  for (let i = 0; i < EST_MAX_ROWS; i++) if (["q", "l", "w", "h", "lbs", "c"].some((p) => get(`${p}_${i}`))) last = i;
  const shown = Math.min(EST_MAX_ROWS, Math.max(5, last + 2));
  const hasRows = inp.rows.length > 0;
  const card = (t: number) => cardFees(t);
  const opts = [est.air, est.ocean];
  const carry = [...KEYS, ...Array.from({ length: EST_MAX_ROWS }, (_, i) => ["q", "l", "w", "h", "lbs", "c"].map((p) => `${p}_${i}`)).flat()].filter((k) => q[k]);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 text-sm">
      <div className="no-print">
        <h1>Estimate</h1>
        <p className="text-zinc-600">Price the customer&apos;s boxes before they ship: Air and Ocean side by side. Type the boxes (the dimensions in inches, the weight in lb) and the result updates by itself. Print it for the customer, or turn it into a warehouse receipt.</p>
        {q.err && <p role="alert" className="mt-2 font-medium text-red-700">{q.err}</p>}
        <AutoForm className="mt-4 grid gap-4">
          <section className="rounded-lg border p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <F label="Customer (optional, printed on the estimate)"><Input name="customer" list="cust" defaultValue={q.customer} placeholder="Name or number" /></F>
              <datalist id="cust">{db.customers.map((c) => <option key={c.no} value={c.name}>{c.no}</option>)}</datalist>
            </div>
            <table className="mt-3 w-full text-left">
              <thead><tr><th className={`${th} w-16`}>Boxes</th><th className={`${th} w-20`}>L (in)</th><th className={`${th} w-20`}>W (in)</th><th className={`${th} w-20`}>H (in)</th><th className={`${th} w-24`}>Weight (lb)</th><th className={th}>Contents</th></tr></thead>
              <tbody>{Array.from({ length: shown }, (_, i) => (
                <tr key={i}>
                  <td className="py-0.5 pr-1"><Input name={`q_${i}`} type="number" min="1" step="1" defaultValue={q[`q_${i}`]} placeholder="1" aria-label={`Number of boxes, line ${i + 1}`} /></td>
                  {(["l", "w", "h", "lbs"] as const).map((k) => <td key={k} className="py-0.5 pr-1"><Input name={`${k}_${i}`} type="number" min="0" step="any" defaultValue={q[`${k}_${i}`]} aria-label={`${k === "lbs" ? "Weight" : k.toUpperCase()}, line ${i + 1}`} /></td>)}
                  <td className="py-0.5"><Input name={`c_${i}`} defaultValue={q[`c_${i}`]} maxLength={120} placeholder="Needed to make the receipt" aria-label={`Contents, line ${i + 1}`} /></td>
                </tr>))}</tbody>
            </table>
            {inp.incomplete.length > 0 && <p className="mt-1 text-xs text-amber-700">Line{inp.incomplete.length > 1 ? "s" : ""} {inp.incomplete.join(", ")} not counted: enter the length, width, height and weight (dimensions up to 200 in, weight up to 2000 lb).</p>}
          </section>
          <section className="rounded-lg border p-3">
            <h2 className="font-bold">Rates and extras</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <F label="Air rate per lb ($)"><Input name="rateAir" type="number" step="0.01" min="0" defaultValue={q.rateAir ?? EST_AIR_RATE} className="text-right" /></F>
              <F label="Ocean rate per cubic foot ($)"><Input name="rateOcean" type="number" step="0.01" min="0" defaultValue={q.rateOcean ?? EST_OCEAN_RATE} className="text-right" /></F>
              <F label="Air handling ($, minimum 35)"><Input name="handlingAir" type="number" step="0.01" min="0" defaultValue={q.handlingAir ?? EST_AIR_HANDLING} className="text-right" /></F>
              <F label="Ocean handling ($, minimum 45)"><Input name="handlingOcean" type="number" step="0.01" min="0" defaultValue={q.handlingOcean ?? EST_OCEAN_HANDLING} className="text-right" /></F>
              <F label="Declared value ($)"><Input name="declared" type="number" step="0.01" min="0" defaultValue={q.declared} className="text-right" /></F>
              <label className="flex items-end gap-1.5 pb-2 text-sm sm:col-span-3"><input type="checkbox" name="insure" value="yes" defaultChecked={q.insure === "yes"} /> The customer accepts insurance (3.5% of the declared value, minimum $50)</label>
              <F label="Pickup ($, minimum 20)"><Input name="pickup" type="number" step="0.01" min="0" defaultValue={q.pickup} className="text-right" /></F>
              <F label="Repacking / consolidation ($, minimum 10)"><Input name="repack" type="number" step="0.01" min="0" defaultValue={q.repack} className="text-right" /></F>
              <F label="Other fee (name)"><Input name="otherLabel" defaultValue={q.otherLabel} maxLength={60} /></F>
              <F label="Other fee ($)"><Input name="other" type="number" step="0.01" min="0" defaultValue={q.other} className="text-right" /></F>
              <F label="Discount / credit ($)"><Input name="credit" type="number" step="0.01" min="0" defaultValue={q.credit} className="text-right" /></F>
            </div>
          </section>
        </AutoForm>
      </div>

      {!hasRows ? <p className="no-print mt-5 text-zinc-600">Enter at least one box to see the estimate.</p> : (
        <section className="mt-5">
          <div className="flex items-start justify-between gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="JP's Logistics & More" className="h-14 w-auto" />
            <div className="text-right"><div className="font-semibold">{usToday()}</div><div className="no-print mt-2"><PrintButton label="Print the estimate" /></div></div>
          </div>
          <h2 className="mt-2 text-center text-2xl font-bold">Estimate{inp.customer ? ` · ${inp.customer}` : ""}</h2>

          <table className="mt-4 w-full text-left">
            <thead className="border-b-2 border-black"><tr><th className={th}>Boxes</th><th className={th}>Size (in)</th><th className={`${th} text-right`}>Weight (lb)</th><th className={`${th} text-right`}>Volumetric (lb)</th><th className={`${th} text-right`}>Billed Air (lb)</th><th className={`${th} text-right`}>Cubic ft</th><th className={th}>Contents</th></tr></thead>
            <tbody>{inp.rows.map((r, i) => { const f = est.figures[i]; return (
              <tr key={i} className="border-b border-zinc-200 align-top">
                <td className={td}>{r.qty}</td><td className={td}>{r.l} × {r.w} × {r.h}</td><td className={`${td} text-right`}>{f.gross}</td>
                <td className={`${td} text-right`}>{f.volumetric}</td><td className={`${td} text-right font-medium`}>{f.chargeable}{f.byVolume && <span className="text-xs text-zinc-500"> vol.</span>}</td><td className={`${td} text-right`}>{f.cuft}</td><td className={td}>{r.contents}</td>
              </tr>); })}</tbody>
            <tfoot><tr className="border-t-2 border-black font-semibold"><td className={td}>{est.totals.pieces}</td><td className={td} /><td className={`${td} text-right`}>{est.totals.gross}</td><td className={`${td} text-right`}>{est.totals.volumetric}</td><td className={`${td} text-right`}>{est.totals.chargeable}</td><td className={`${td} text-right`}>{est.totals.cuft}</td><td className={td} /></tr></tfoot>
          </table>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {opts.map((o) => (
              <div key={o.ship} className={`rounded-lg border-2 p-3 ${est.cheaper?.ship === o.ship ? "border-green-600" : "border-zinc-300"}`}>
                <div className="flex items-baseline justify-between"><h3 className="text-lg font-bold">{o.ship === "Air" ? "By Air" : "By Ocean"}</h3>{est.cheaper?.ship === o.ship && <span className="text-xs font-semibold text-green-700">Lower price</span>}</div>
                <table className="mt-2 w-full"><tbody>{o.lines.map((l, i) => (
                  <tr key={i} className="border-b border-zinc-100 align-top"><td className="py-1 pr-2">{l.label}{l.detail && <span className="block text-xs text-zinc-500">{l.detail}</span>}</td><td className="py-1 text-right">{l.kind === "credit" ? "−" : ""}{money(l.amount)}</td></tr>))}</tbody></table>
                <div className="mt-2 flex items-baseline justify-between border-t-2 border-black pt-2"><span className="font-bold">Estimated total</span><span className="text-xl font-bold">{money(o.total)}</span></div>
                <p className="no-print mt-1 text-xs text-zinc-600">By card: Square invoice {money(card(o.total).invoice.total)} · card present {money(card(o.total).present.total)}</p>
              </div>))}
          </div>
          <p className="mt-4 border border-zinc-400 p-2 text-xs font-medium">{ESTIMATE_NOTE}</p>

          <form action={estimateToReceipt} className="no-print mt-5 flex flex-wrap items-end gap-2 rounded-lg border p-3">
            {carry.map((k) => <input key={k} type="hidden" name={k} value={q[k]} />)}
            <div className="mr-2"><div className="font-bold">Make a warehouse receipt from this estimate</div><div className="text-xs text-zinc-600">Opens a new receipt for the customer above (pieces, fees and insurance included, marked as an estimate). Every box needs its contents.</div></div>
            <select name="ship" className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Ship type"><option value="Air">Air (JPF)</option><option value="Ocean">Ocean (JPL)</option></select>
            <Button type="submit">Create the receipt</Button>
          </form>
        </section>
      )}
    </main>
  );
}
