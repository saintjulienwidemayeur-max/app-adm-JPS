import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db, vol, cuft, chargeable, r2, charges, credits, quote, insuranceFee, total, paidAmt, balance, payStatus, money, wrCode, custOf, PAY_METHODS } from "@/lib/wh-store";
import { cardFees } from "@/lib/pricing";
import { updateWR, addPiece, updatePiece, deletePiece, createInvoice, addPayment, addFee, saveFees, deleteFee } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const lnk = "inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-100";
const sel = "h-9 w-full rounded-md border bg-white px-2 text-sm";
const F = ({ label, children }: { label: string; children: ReactNode }) => <label className="grid gap-1 text-xs font-medium text-zinc-600">{label}{children}</label>;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const q = await searchParams;
  const w = db.wrs.find((x) => x.id === id);
  if (!w) notFound();
  const cust = custOf(w);
  const loaded = new Set(db.loads.map((l) => l.no));
  const anyLoaded = w.pieces.some((p) => loaded.has(p.no));
  const code = wrCode(w);
  const mail = `mailto:${w.email}?subject=${encodeURIComponent(`JP's Logistics – Warehouse receipt ${code}`)}&body=${encodeURIComponent(`Hello ${w.customer},\n\nYour warehouse receipt ${code} has ${w.pieces.length} piece(s). Total: ${money(total(w))}.\n\nJP's Logistics & More`)}`;
  const lbs = r2(w.pieces.reduce((a, p) => a + p.lbs, 0));
  const ins = quote(w);
  const card = cardFees(balance(w));
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/warehouse/receipts" className="text-sm text-brand underline">All receipts</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1>{code} · {w.customer} <span className="text-base font-normal text-zinc-600">· {w.ship} · {w.date}{w.route && ` · ${w.route}`}</span></h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/warehouse/receipts/${w.id}/report`} className={lnk}>View receipt</Link>
          {w.email ? <a href={mail} className={lnk}>Email receipt</a> : <span className="inline-flex h-9 items-center text-xs text-zinc-500">Add an email to send the receipt</span>}
          {w.pieces.length > 0 && <Link href={`/warehouse/receipts/${w.id}/labels`} className={`${lnk} !border-brand !bg-brand !text-white`}>Print labels</Link>}
        </div>
      </div>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      <section className="mt-4 rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between"><h2 className="font-bold">Customer {w.cust}</h2><Link href={`/warehouse/customers/${w.cust}`} className="text-brand underline">Edit customer details</Link></div>
        {cust ? (
          <dl className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-3">
            <div><dt className="text-xs text-zinc-500">Phone</dt><dd>{cust.phone || "–"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Email</dt><dd>{cust.email || "–"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Billing address</dt><dd>{cust.billing || "–"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Consignee</dt><dd>{cust.consignee || cust.name}</dd></div>
            <div><dt className="text-xs text-zinc-500">Destination</dt><dd>{[cust.consigneeCity, cust.consigneeCountry].filter(Boolean).join(", ") || "–"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Representative</dt><dd>{db.reps.find((r) => r.id === w.rep)?.name ?? "–"}</dd></div>
          </dl>
        ) : <p className="mt-1 text-zinc-600">No customer record.</p>}
      </section>

      <section className="mt-5 rounded-lg border p-3">
        <div className="flex items-center justify-between"><h2 className="font-bold">Pieces</h2>
        </div>
        {w.pieces.length > 0 && (
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr>{["Item", "Type", "L×W×H (in)", "Weight (lb)", "Volume (lb)", "Cuft", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{w.pieces.map((p) => (
              <tr key={p.no} className="border-b border-zinc-100 align-top">
                <td className={td}>{p.no}</td><td className={td}>{p.type}</td><td className={td}>{p.l}×{p.w}×{p.h}</td><td className={td}>{p.lbs}</td><td className={td}>{vol(p)}</td><td className={td}>{cuft(p)}</td>
                <td className={td}>{loaded.has(p.no) ? <span className="text-zinc-500">Loaded</span> : (
                  <details><summary className="cursor-pointer text-brand underline">Edit</summary>
                    <form action={updatePiece} className="mt-1 flex flex-wrap gap-1"><input type="hidden" name="wr" value={w.id} /><input type="hidden" name="no" value={p.no} />
                      <Input name="type" defaultValue={p.type} className="w-32" aria-label="Type" />
                      {(["l", "w", "h", "lbs"] as const).map((k) => <Input key={k} name={k} type="number" step="any" min="0" defaultValue={p[k]} className="w-16" aria-label={k} required />)}
                      <Button type="submit">Save</Button></form>
                    <form action={deletePiece} className="mt-1"><input type="hidden" name="wr" value={w.id} /><input type="hidden" name="no" value={p.no} /><button className="text-red-700 underline">Delete piece</button></form>
                  </details>)}</td>
              </tr>))}</tbody>
            <tfoot><tr className="font-semibold"><td className={td} colSpan={3}>{w.pieces.length} piece{w.pieces.length > 1 ? "s" : ""}</td><td className={td}>{lbs}</td><td className={td} colSpan={3} /></tr></tfoot>
          </table>
        )}
        <form action={addPiece} className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-[1fr_repeat(4,5rem)_auto]">
          <input type="hidden" name="wr" value={w.id} />
          <Input name="type" placeholder="Type (BOX - OTHER)" className="col-span-4 sm:col-span-1" />
          {["l", "w", "h", "lbs"].map((k) => <Input key={k} name={k} type="number" step="any" min="0" placeholder={k === "lbs" ? "lb" : k.toUpperCase()} aria-label={k} required />)}
          <Button type="submit" className="col-span-4 sm:col-span-1">Add piece</Button>
        </form>
      </section>

      <section className="mt-5 rounded-lg border p-3">
        <h2 className="font-bold">Fees and credits</h2>
        <p className="text-xs text-zinc-600">One line per fee. Use a credit for a discount or a credit memo: it is subtracted from the total.</p>
        <datalist id="feeNames">{[...db.feeNames.charge, ...db.feeNames.credit].map((n) => <option key={n} value={n} />)}</datalist>
        <form action={saveFees} className="mt-2">
          <input type="hidden" name="wr" value={w.id} />
          <table className="w-full text-left text-sm">
            <thead><tr><th className={th}>Description</th><th className={`${th} w-32`}>Type</th><th className={`${th} w-32 text-right`}>Amount ($)</th><th className={`${th} w-20`} /></tr></thead>
            <tbody>
              {w.fees.length === 0 && ins.customer === 0 && <tr><td className={`${td} text-zinc-500`} colSpan={4}>No fees yet. Add the first one below.</td></tr>}
              {w.fees.map((f) => (
                <tr key={f.id} className="border-b border-zinc-100">
                  <td className={td}><Input name={`label_${f.id}`} list="feeNames" defaultValue={f.label} maxLength={60} aria-label="Fee description" required /></td>
                  <td className={td}><select name={`kind_${f.id}`} defaultValue={f.kind} className={sel} aria-label="Fee type"><option value="charge">Charge</option><option value="credit">Credit</option></select></td>
                  <td className={td}><Input name={`amount_${f.id}`} type="number" step="0.01" min="0.01" defaultValue={f.amount.toFixed(2)} className="text-right" aria-label="Fee amount" required /></td>
                  <td className={td}><button formAction={deleteFee.bind(null, w.id, f.id)} formNoValidate className="text-red-700 underline" aria-label={`Remove ${f.label}`}>Remove</button></td>
                </tr>))}
              {w.insurance === "Accepted" && ins.customer > 0 && (
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <td className={td}>Certificate of insurance <span className="text-xs text-zinc-500">· declared value {money(w.declared)} · automatic</span></td>
                  <td className={td}>Charge</td><td className={`${td} text-right`}>{money(ins.customer)}</td><td className={td} />
                </tr>)}
            </tbody>
          </table>
          {w.fees.length > 0 && <Button type="submit" className="mt-2">Save fees</Button>}
        </form>
        <form action={addFee} className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
          <input type="hidden" name="wr" value={w.id} />
          <Input name="label" list="feeNames" placeholder="New fee or credit (pick one or type a new name)" maxLength={60} aria-label="New fee description" required />
          <select name="kind" className={sel} aria-label="Type of the new line"><option value="charge">Charge</option><option value="credit">Credit</option></select>
          <Input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount ($)" aria-label="Amount of the new line" className="text-right" required />
          <Button type="submit">Add line</Button>
        </form>

        <dl className="mt-4 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt>Chargeable weight</dt><dd className="text-right">{r2(w.pieces.reduce((a, p) => a + chargeable(p), 0))} lb</dd>
          <dt>Charges</dt><dd className="text-right">{money(charges(w))}</dd>
          {credits(w) > 0 && <><dt>Credits</dt><dd className="text-right">−{money(credits(w))}</dd></>}
          {insuranceFee(w) > 0 && <><dt>Insurance</dt><dd className="text-right">{money(insuranceFee(w))}</dd></>}
          <dt className="font-bold">Total</dt><dd className="text-right font-bold">{money(total(w))}</dd>
          <dt>Paid</dt><dd className="text-right">{money(paidAmt(w))}</dd>
          <dt>Balance</dt><dd className="text-right">{money(balance(w))}</dd>
          <dt>Payment status</dt><dd className="text-right font-semibold">{payStatus(w)}</dd>
        </dl>
        {balance(w) > 0 && (
          <p className="mt-2 text-xs text-zinc-600">
            Paying the balance ({money(balance(w))}) by credit card: Square invoice <b>{money(card.invoice.total)}</b> · card present <b>{money(card.present.total)}</b> · manual entry <b>{money(card.manual.total)}</b>.
          </p>
        )}
      </section>

      <section className="mt-5 rounded-lg border p-3">
        <h2 className="font-bold">Receipt details</h2>
        <form action={updateWR} className="mt-2 grid gap-2 sm:grid-cols-4">
          <input type="hidden" name="wr" value={w.id} />
          <F label="Ship type">
            <select name="ship" defaultValue={w.ship} disabled={anyLoaded} className={sel}><option value="Air">Air (JPF)</option><option value="Ocean">Ocean (JPL)</option></select>
            {anyLoaded && <input type="hidden" name="ship" value={w.ship} />}
          </F>
          <F label="Route"><Input name="route" defaultValue={w.route} maxLength={12} /></F>
          <F label="Representative">
            <select name="rep" defaultValue={w.rep} className={sel}><option value="">None</option>{db.reps.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.initials})</option>)}</select>
          </F>
          <F label="Receipt email"><Input name="email" type="email" defaultValue={w.email} /></F>
          <F label="Declared value ($)"><Input name="declared" type="number" step="0.01" min="0" defaultValue={w.declared} /></F>
          <F label="Insurance"><select name="insurance" defaultValue={w.insurance} className={sel}><option>Declined</option><option>Accepted</option></select></F>
          <div className="sm:col-span-2"><F label="Items declared as"><Input name="contents" defaultValue={w.contents} /></F></div>
          <div className="sm:col-span-4"><F label="Comments"><Input name="comments" defaultValue={w.comments} /></F></div>
          <Button type="submit" className="sm:col-span-4 sm:w-40">Save details</Button>
        </form>
        {w.declared > 0 ? (
          <p className="mt-2 text-xs text-zinc-600">
            Insurance for a declared value of {money(w.declared)}: the customer pays <b>{money(ins.customer)}</b> (JP&apos;s cost {money(ins.jps)}).
            {w.insurance === "Declined" ? " Declined: not charged." : " Accepted: added to the total."}
          </p>
        ) : <p className="mt-2 text-xs text-zinc-600">Enter a declared value to see the insurance price.</p>}
      </section>

      <section className="mt-5 rounded-lg border p-3">
        <div className="flex items-center justify-between"><h2 className="font-bold">Invoice and payments</h2>
          {w.invoice ? <Link href={`/warehouse/invoices/${w.invoice}`} className="text-sm font-semibold text-brand underline">{w.invoice} · view invoice</Link> : <form action={createInvoice}><input type="hidden" name="wr" value={w.id} /><Button type="submit" variant="outline">Create invoice</Button></form>}
        </div>
        {w.payments.length > 0 && <ul className="mt-2 text-sm">{w.payments.map((p, i) => <li key={i}>{p.date} · {money(p.amount)} · {p.method}{p.ref && ` · ${p.ref}`}</li>)}</ul>}
        {balance(w) > 0 && (
          <form action={addPayment} className="mt-3 grid gap-2 sm:grid-cols-[8rem_10rem_1fr_auto]">
            <input type="hidden" name="wr" value={w.id} />
            <Input name="amount" type="number" step="0.01" min="0" placeholder="Amount ($)" aria-label="Amount" required />
            <select name="method" className={sel} aria-label="Payment type">{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            <Input name="ref" placeholder="Check # or confirmation" />
            <Button type="submit">Add payment</Button>
          </form>
        )}
      </section>
    </main>
  );
}
