import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db, vol, cuft, chargeable, r2, subtotal, total, paidAmt, balance, payStatus, money } from "@/lib/wh-store";
import { updateWR, addPiece, updatePiece, deletePiece, createInvoice, addPayment } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const lnk = "inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-100";
const F = ({ label, children }: { label: string; children: ReactNode }) => <label className="grid gap-1 text-xs font-medium text-zinc-600">{label}{children}</label>;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const q = await searchParams;
  const w = db.wrs.find((x) => x.id === id);
  if (!w) notFound();
  const loaded = new Set(db.loads.map((l) => l.no));
  const mail = `mailto:${w.email}?subject=${encodeURIComponent(`JP's Logistics – Warehouse receipt JPF-${w.id}`)}&body=${encodeURIComponent(`Hello ${w.customer},\n\nYour warehouse receipt JPF-${w.id} has ${w.pieces.length} piece(s). Estimated total: ${money(total(w))}.\n\nJP's Logistics & More`)}`;
  const lbs = r2(w.pieces.reduce((a, p) => a + p.lbs, 0));
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/warehouse/receipts" className="text-sm text-brand underline">All receipts</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1>JPF-{w.id} · {w.customer} <span className="text-base font-normal text-zinc-600">· {w.ship} · {w.date}{w.route && ` · ${w.route}`}</span></h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/warehouse/receipts/${w.id}/report`} className={lnk}>View receipt</Link>
          <Link href={`/warehouse/receipts/${w.id}/report?estimate=1`} className={lnk}>View estimate</Link>
          {w.email ? <a href={mail} className={lnk}>Email receipt</a> : <span className="inline-flex h-9 items-center text-xs text-zinc-500">Add an email to send the receipt</span>}
          {w.pieces.length > 0 && <Link href={`/warehouse/receipts/${w.id}/labels`} className={`${lnk} !border-brand !bg-brand !text-white`}>Print labels</Link>}
        </div>
      </div>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

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
        <h2 className="font-bold">Fees and details</h2>
        <form action={updateWR} className="mt-2 grid gap-2 sm:grid-cols-4">
          <input type="hidden" name="wr" value={w.id} />
          <F label="Subtotal ($)"><Input name="subtotal" type="number" step="0.01" min="0" defaultValue={w.subtotal} /></F>
          <F label="Handling fees ($)"><Input name="handling" type="number" step="0.01" min="0" defaultValue={w.handling} /></F>
          <F label="Other fees ($)"><Input name="other" type="number" step="0.01" min="0" defaultValue={w.other} /></F>
          <F label="Declared value ($)"><Input name="declared" type="number" step="0.01" min="0" defaultValue={w.declared} /></F>
          <F label="Insurance"><select name="insurance" defaultValue={w.insurance} className="h-9 rounded-md border bg-white px-2 text-sm"><option>Declined</option><option>Accepted</option></select></F>
          <F label="Route code"><Input name="route" defaultValue={w.route} maxLength={6} /></F>
          <F label="Customer email"><Input name="email" type="email" defaultValue={w.email} /></F>
          <div className="sm:col-span-2"><F label="Comments"><Input name="comments" defaultValue={w.comments} /></F></div>
          <Button type="submit" className="sm:col-span-4 sm:w-40">Save details</Button>
        </form>
        <dl className="mt-4 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt>Chargeable weight</dt><dd className="text-right">{r2(w.pieces.reduce((a, p) => a + chargeable(p), 0))} lb</dd>
          <dt>Subtotal</dt><dd className="text-right">{money(subtotal(w))}</dd>
          <dt>Handling fees</dt><dd className="text-right">{money(w.handling)}</dd>
          <dt>Other fees</dt><dd className="text-right">{money(w.other)}</dd>
          <dt className="font-bold">Estimated total</dt><dd className="text-right font-bold">{money(total(w))}</dd>
          <dt>Paid</dt><dd className="text-right">{money(paidAmt(w))}</dd>
          <dt>Balance</dt><dd className="text-right">{money(balance(w))}</dd>
          <dt>Payment status</dt><dd className="text-right font-semibold">{payStatus(w)}</dd>
        </dl>
      </section>

      <section className="mt-5 rounded-lg border p-3">
        <div className="flex items-center justify-between"><h2 className="font-bold">Invoice and payments</h2>
          {w.invoice ? <span className="text-sm font-semibold">{w.invoice}</span> : <form action={createInvoice}><input type="hidden" name="wr" value={w.id} /><Button type="submit" variant="outline">Create invoice</Button></form>}
        </div>
        {w.payments.length > 0 && <ul className="mt-2 text-sm">{w.payments.map((p, i) => <li key={i}>{p.date} · {money(p.amount)} · {p.method}{p.ref && ` · ${p.ref}`}</li>)}</ul>}
        {balance(w) > 0 && (
          <form action={addPayment} className="mt-3 grid gap-2 sm:grid-cols-[8rem_9rem_1fr_auto]">
            <input type="hidden" name="wr" value={w.id} />
            <Input name="amount" type="number" step="0.01" min="0" placeholder="Amount ($)" aria-label="Amount" required />
            <select name="method" className="h-9 rounded-md border bg-white px-2 text-sm"><option>Cash</option><option>Check</option><option>Card</option><option>Zelle</option><option>MonCash</option><option>Other</option></select>
            <Input name="ref" placeholder="Check # or confirmation" />
            <Button type="submit">Add payment</Button>
          </form>
        )}
      </section>
    </main>
  );
}
