import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db, vol, cuft, chargeable, r2, charges, credits, quote, insuranceFee, total, paidAmt, balance, payStatus, money, wrCode, custOf, creditOf, freightFee, freightQty, freightDesc, noticeState, lastNotice, estimateFor, otherShip, defaultRate } from "@/lib/wh-store";
import { CompareShip } from "@/components/compare-ship";
import { cardFees } from "@/lib/pricing";
import { updateWR, addPiece, updatePiece, deletePiece, createInvoice, addPayment, voidPayment, applyCredit, addFee, saveFees, deleteFee, switchShip, markNotified } from "@/lib/wh-actions";
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
  const nstate = noticeState(w), notice = lastNotice(w);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/warehouse/receipts" className="text-sm text-brand underline">All receipts</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1>{code} · {w.customer} <span className="text-base font-normal text-zinc-600">· {w.ship} · {w.date}{w.route && ` · ${w.route}`}</span></h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/warehouse/receipts/${w.id}/report`} className={lnk}>View receipt</Link>
          {w.email ? <a href={mail} className={lnk}>Email receipt</a> : <span className="inline-flex h-9 items-center text-xs text-zinc-500">Add an email to send the receipt</span>}
          {w.pieces.length > 0 && !w.invoice && <CompareShip current={estimateFor(w, w.ship)} other={estimateFor(w, otherShip(w))} wr={wrCode(w)} locked={anyLoaded} switchAction={switchShip.bind(null, w.id)} />}
          {w.pieces.length > 0 && <Link href={`/warehouse/receipts/${w.id}/labels`} className={`${lnk} !border-brand !bg-brand !text-white`}>Print labels</Link>}
        </div>
      </div>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      <section className="mt-4 rounded-lg border p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Customer notification</h2>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${nstate === "current" ? "bg-green-100 text-green-800" : nstate === "outdated" ? "bg-amber-100 text-amber-900" : "bg-zinc-100 text-zinc-700"}`}>
            {nstate === "current" ? `Customer notified by ${notice?.channel} · ${notice?.date} ${notice?.time}` : nstate === "outdated" ? `Update NOT sent: the receipt changed after the ${notice?.channel} of ${notice?.date}` : "Customer not notified yet"}
          </span></div>
        <p className="mt-1 text-xs text-zinc-600">After you send the receipt (Email or WhatsApp), record it here. If the receipt changes later, the update has to be sent and recorded again.</p>
        <form className="mt-2 flex flex-wrap items-center gap-2">
          <button formAction={markNotified.bind(null, w.id, "Email")} className={lnk}>Record: sent by email</button>
          <button formAction={markNotified.bind(null, w.id, "WhatsApp")} className={lnk}>Record: sent by WhatsApp</button>
          {w.notices && w.notices.length > 0 && <span className="text-xs text-zinc-500">{w.notices.length} notice{w.notices.length > 1 ? "s" : ""} sent · {w.notices.map((n) => `${n.channel} ${n.date}`).join(" · ")}</span>}
        </form>
      </section>

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
            <thead><tr>{["Item", "Type", "Contents", "L×W×H (in)", "Weight (lb)", "Volume (lb)", "Cuft", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{w.pieces.map((p) => (
              <tr key={p.no} className="border-b border-zinc-100 align-top">
                <td className={td}>{p.no}</td><td className={td}>{p.type}</td><td className={td}>{p.contents || <span className="text-red-700">Required</span>}</td><td className={td}>{p.l}×{p.w}×{p.h}</td><td className={td}>{p.lbs}</td><td className={td}>{vol(p)}</td><td className={td}>{cuft(p)}</td>
                <td className={td}>{loaded.has(p.no) ? <span className="text-zinc-500">Loaded</span> : (
                  <details><summary className="cursor-pointer text-brand underline">Edit</summary>
                    <form action={updatePiece} className="mt-1 flex flex-wrap gap-1"><input type="hidden" name="wr" value={w.id} /><input type="hidden" name="no" value={p.no} />
                      <Input name="type" defaultValue={p.type} className="w-32" aria-label="Type" />
                      <Input name="contents" defaultValue={p.contents} placeholder="Contents (required)" maxLength={120} className="w-56" aria-label="Contents" required />
                      {(["l", "w", "h", "lbs"] as const).map((k) => <Input key={k} name={k} type="number" step="any" min="0" defaultValue={p[k]} className="w-16" aria-label={k} required />)}
                      <Button type="submit">Save</Button></form>
                    <form action={deletePiece} className="mt-1"><input type="hidden" name="wr" value={w.id} /><input type="hidden" name="no" value={p.no} /><button className="text-red-700 underline">Delete piece</button></form>
                  </details>)}</td>
              </tr>))}</tbody>
            <tfoot><tr className="font-semibold"><td className={td} colSpan={4}>{w.pieces.length} piece{w.pieces.length > 1 ? "s" : ""}</td><td className={td}>{lbs}</td><td className={td} colSpan={3} /></tr></tfoot>
          </table>
        )}
        <form action={addPiece} className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-[1fr_repeat(4,5rem)_auto]">
          <input type="hidden" name="wr" value={w.id} />
          <Input name="type" placeholder="Type (BOX - OTHER)" className="col-span-4 sm:col-span-1" />
          <Input name="contents" placeholder="Contents of this piece (required)" maxLength={120} className="col-span-4 sm:col-span-5" required />
          {["l", "w", "h", "lbs"].map((k) => <Input key={k} name={k} type="number" step="any" min="0" placeholder={k === "lbs" ? "lb" : k.toUpperCase()} aria-label={k} required />)}
          <Button type="submit" className="col-span-4 sm:col-span-1">Add piece</Button>
        </form>
      </section>

      <section className="mt-5 rounded-lg border p-3">
        <h2 className="font-bold">Fees and credits</h2>
        <p className="text-xs text-zinc-600">The freight line (and the Ocean handling fee) is added automatically; Air is billed on the larger of the gross and volumetric weight, Ocean on cubic feet. One line per fee. Use a credit for a discount or a credit memo: it is subtracted from the total.</p>
        <datalist id="feeNames">{[...db.feeNames.charge, ...db.feeNames.credit].map((n) => <option key={n} value={n} />)}</datalist>
        <form action={saveFees} className="mt-2">
          <input type="hidden" name="wr" value={w.id} />
          <table className="w-full text-left text-sm">
            <thead><tr><th className={th}>Description</th><th className={`${th} w-32`}>Type</th><th className={`${th} w-32 text-right`}>Amount ($)</th><th className={`${th} w-20`} /></tr></thead>
            <tbody>
              {freightFee(w) > 0 && (
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <td className={td}>{freightDesc(w)} <span className="text-xs text-zinc-500">· {freightQty(w)} {w.ship === "Ocean" ? "cuf" : "lbs"} × {money(w.rate ?? 0)} · automatic</span></td>
                  <td className={td}>Charge</td><td className={`${td} text-right`}>{money(freightFee(w))}</td><td className={td} />
                </tr>)}
              {w.fees.length === 0 && ins.customer === 0 && freightFee(w) === 0 && <tr><td className={`${td} text-zinc-500`} colSpan={4}>No fees yet. Add the first one below.</td></tr>}
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
          <input type="hidden" name="rep" value={w.rep} />
          <F label={w.ship === "Ocean" ? "Rate per cubic foot ($)" : "Rate per lb ($)"}><Input name="rate" type="number" step="0.01" min="0" defaultValue={(w.rate ?? 0).toFixed(2)} className="text-right" /></F>
          <F label="Notification email"><Input name="email" type="email" defaultValue={w.email} /></F>
          <F label="Declared value ($)"><Input name="declared" type="number" step="0.01" min="0" defaultValue={w.declared} /></F>
          <F label="Insurance"><select name="insurance" defaultValue={w.insurance} className={sel}><option>Declined</option><option>Accepted</option></select></F>
          <label className="flex items-end gap-1.5 pb-2 text-sm sm:col-span-2"><input type="checkbox" name="estimate" value="yes" defaultChecked={w.estimate} /> Customer asked for an estimate (shown on the printed receipt)</label>
          <div className="sm:col-span-4"><F label="Comments"><Input name="comments" defaultValue={w.comments} /></F></div>
          <Button type="submit" className="sm:col-span-4 sm:w-40">Save details</Button>
        </form>
        {w.declared > 0 ? (
          <p className="mt-2 text-xs text-zinc-600">
            Insurance for a declared value of {money(w.declared)}: the customer pays <b>{money(ins.customer)}</b> (minimum $50).
            {w.insurance === "Declined" ? " Declined: not charged." : " Accepted: added to the total."}
          </p>
        ) : <p className="mt-2 text-xs text-zinc-600">Enter a declared value to see the insurance price (minimum $50).</p>}
      </section>

      <section className="mt-5 rounded-lg border p-3">
        <div className="flex items-center justify-between"><h2 className="font-bold">Invoice and payments</h2>
          {w.invoice ? <Link href={`/warehouse/invoices/${w.invoice}`} className="text-sm font-semibold text-brand underline">{w.invoice} · view invoice</Link> : <form action={createInvoice}><input type="hidden" name="wr" value={w.id} /><Button type="submit" variant="outline">Create invoice</Button></form>}
        </div>
        {w.payments.length > 0 && (
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr>{["Date", "Method", "Reference", "Amount", "", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>{w.payments.map((p, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className={td}>{p.date}{p.time && ` ${p.time}`}</td><td className={td}>{p.method}</td><td className={td}>{p.ref || "–"}</td><td className={td}>{money(p.amount)}</td>
                <td className={td}><Link href={`/warehouse/receipts/${w.id}/payments/${i}`} className="text-brand underline">Payment receipt</Link></td>
                <td className={td}><form><button formAction={voidPayment.bind(null, w.id, i)} className="text-red-700 underline" aria-label={`Void payment ${i + 1}`}>Void</button></form></td>
              </tr>))}</tbody>
          </table>
        )}
        <p className="mt-2 text-sm">Total <b>{money(total(w))}</b> · paid <b>{money(paidAmt(w))}</b> · balance <b>{money(balance(w))}</b></p>
        {balance(w) > 0 && creditOf(cust) > 0 && (
          <form className="mt-2 flex items-center gap-2 text-sm">Customer credit on file: <b>{money(creditOf(cust))}</b><button formAction={applyCredit.bind(null, w.id)} className="rounded-md border border-zinc-300 bg-white px-3 py-1 font-medium hover:bg-zinc-100">Apply to this balance</button></form>
        )}
        <p className="mt-1 text-xs"><Link href={`/warehouse/payments?c=${w.cust}`} className="text-brand underline">Receive one payment for several receipts</Link></p>
        {balance(w) > 0 && (
          <form action={addPayment} className="mt-3 grid gap-2 sm:grid-cols-[8rem_11rem_1fr_auto]">
            <input type="hidden" name="wr" value={w.id} />
            <Input name="amount" type="number" step="0.01" min="0.01" max={balance(w)} placeholder="Amount ($)" aria-label="Amount" required />
            <Input name="method" list="payMethods" placeholder="Paid by (pick or type a new method)" aria-label="Payment type" maxLength={30} required />
            <Input name="ref" placeholder="Check # or confirmation" />
            <Button type="submit">Add payment</Button>
            <datalist id="payMethods">{db.payMethods.map((m) => <option key={m} value={m} />)}</datalist>
          </form>
        )}
      </section>
    </main>
  );
}
