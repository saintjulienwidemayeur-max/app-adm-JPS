import Link from "next/link";
import { billingUrl } from "@/lib/billing-link";
import { notFound } from "next/navigation";
import { db, wrCode, total, money, payStatus, rateFor, oldBalance, oldOpen } from "@/lib/wh-store";
import { saveCustomer, saveCustomerRates } from "@/lib/wh-actions";
import { emailProblem, PROBLEM_TEXT } from "@/lib/mailrules";
import { CustomerFields } from "@/components/customer-fields";
import { Button } from "@/components/ui/button";

type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ params, searchParams }: { params: Promise<{ no: string }>; searchParams: SP }) {
  const { no } = await params;
  const q = await searchParams;
  const c = db.customers.find((x) => x.no === Number(no));
  if (!c) notFound();
  const wrs = db.wrs.filter((w) => w.cust === c.no);
  const old = db.oldInvoices.filter((o) => o.cust === c.no), oldOwed = old.reduce((a, o) => a + oldBalance(o), 0);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/warehouse/customers" className="text-sm text-brand underline">All customers</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2"><h1>Customer {c.no} · {c.name}</h1><Link href={`/warehouse/customers/${c.no}/statement`} className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-100">Statement</Link></div>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      {emailProblem(c) && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">No real e-mail yet ({PROBLEM_TEXT[emailProblem(c) as "missing"]}). This customer is not e-mailed and not invited to the website until you enter their own address below.</p>}
      <form action={saveCustomer} className="mt-4 rounded-lg border p-3">
        <input type="hidden" name="no" value={c.no} />
        <CustomerFields c={c} />
        <Button type="submit" className="mt-4">Save customer</Button>
      </form>

      <section className="mt-6 rounded-lg border p-3">
        <h2 className="font-bold">Rates</h2>
        <p className="text-xs text-zinc-600">This customer&apos;s own rates. Air: per lb (the larger of gross and volumetric weight). Ocean: per cubic foot. They are used on this customer&apos;s new receipts and estimates (now: Air {money(rateFor(c, "Air"))} per lb, Ocean {money(rateFor(c, "Ocean"))} per cubic foot). Leave a box empty for the standard rate.</p>
        <form action={saveCustomerRates} className="mt-2 grid gap-2 sm:grid-cols-6">
          <input type="hidden" name="no" value={c.no} />
          {([["air", "Air / lb"], ["ocean", "Ocean / cuft"], ["capa", "Cap-Air"], ["capo", "Cap-Ocean"], ["sdq", "SDQ"], ["droc", "DR Ocean"]] as const).map(([k, label]) => (
            <label key={k} className="grid gap-1 text-xs font-medium text-zinc-600">{label}<input name={`r_${k}`} type="number" step="0.01" min="0" defaultValue={c.rates?.[k] ?? ""} className="h-9 w-full rounded-md border px-2 text-right text-sm" /></label>))}
          <button type="submit" className="h-9 self-end rounded-md bg-brand px-4 text-sm font-medium text-white sm:col-span-6 sm:w-36">Save rates</button>
        </form>
        {(c.whatsapp || c.altPhone || c.emailMore || c.idOnFile || c.legacyRep || c.since) && (
          <p className="mt-3 text-xs text-zinc-600">From the old system:{c.whatsapp && ` WhatsApp ${c.whatsapp}.`}{c.altPhone && ` Other phone ${c.altPhone}.`}{c.emailMore && ` Other e-mails: ${c.emailMore}.`}{c.idOnFile && " ID on file."}{c.legacyRep && ` Rep code ${c.legacyRep}.`}{c.since && ` Customer since ${c.since}.`}</p>
        )}
      </section>

      {old.length > 0 && <p className="mt-4 text-sm">{billingUrl() ? <a href={billingUrl(`/oldinvoices?c=${c.no}`)} className="font-semibold text-brand underline">{old.length} old invoice{old.length === 1 ? "" : "s"}</a> : <b>{old.length} old invoice{old.length === 1 ? "" : "s"}</b>} (old billing system){oldOwed > 0 ? <> · <b className="text-red-700">{money(oldOwed)} still owed</b> on {old.filter(oldOpen).length}</> : " · nothing owed"}</p>}
      <h2 className="mt-6 font-bold">Warehouse receipts ({wrs.length})</h2>
      {wrs.length === 0 ? <p className="mt-1 text-sm text-zinc-600">No receipts yet.</p> : (
        <table className="mt-2 w-full text-left text-sm">
          <thead><tr>{["Receipt", "Date", "Ship", "Pieces", "Total", "Payment", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{wrs.map((w) => (
            <tr key={w.id} className="border-b border-zinc-100">
              <td className={`${td} font-semibold`}>{wrCode(w)}</td><td className={td}>{w.date}</td><td className={td}>{w.ship}</td><td className={td}>{w.pieces.length}</td>
              <td className={td}>{money(total(w))}</td><td className={td}>{payStatus(w)}</td>
              <td className={td}><Link href={`/warehouse/receipts/${w.id}`} className="text-brand underline">Open</Link></td>
            </tr>))}</tbody>
        </table>
      )}
    </main>
  );
}
