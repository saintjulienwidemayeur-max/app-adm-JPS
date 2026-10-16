import Link from "next/link";
import { db, money, oldBalance, oldOpen } from "@/lib/wh-store";
import { shortDate } from "@/lib/fmt";
import { AutoForm } from "@/components/auto-form";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Old invoices · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const PER = 25;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams, needle = (q.q ?? "").trim().toLowerCase(), cno = Number(q.c) || 0;
  const names = new Map(db.customers.map((c) => [c.no, c.name]));
  const all = db.oldInvoices.filter((o) => (!cno || o.cust === cno) && (!q.s || (q.s === "open" ? oldOpen(o) : !oldOpen(o))) && (!needle || `${o.no} ${o.cust} ${names.get(o.cust) ?? ""} ${o.shipment}`.toLowerCase().includes(needle)));
  const sorted = [...all].reverse(); // newest first
  const pages = Math.max(1, Math.ceil(sorted.length / PER)), page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const rows = sorted.slice((page - 1) * PER, page * PER);
  const owed = all.reduce((a, o) => a + oldBalance(o), 0);
  const link = (p: number) => `/warehouse/oldinvoices?${new URLSearchParams({ ...(q.q && { q: q.q }), ...(q.s && { s: q.s }), ...(cno && { c: String(cno) }), page: String(p) })}`;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1>Old invoices</h1>
      <p className="text-sm text-zinc-600">The invoices of the old billing system, for reference. &quot;Open&quot; means the old system did not mark it paid and the payments applied do not cover it.{db.oldInvoices.length === 0 && <> Nothing here yet: <Link href="/settings/import" className="text-brand underline">import them</Link> (administrators).</>}</p>
      {cno > 0 && <p className="mt-2 text-sm">Customer <b>{names.get(cno) ?? cno}</b> · <Link href="/warehouse/oldinvoices" className="text-brand underline">show everyone</Link></p>}
      <AutoForm className="mt-4 flex flex-wrap items-center gap-2">
        {cno > 0 && <input type="hidden" name="c" value={cno} />}
        <Input name="q" defaultValue={q.q} placeholder="Search an invoice number, a customer or a shipment" className="w-72" aria-label="Search old invoices" />
        <select name="s" defaultValue={q.s ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Status"><option value="">All</option><option value="open">Open</option><option value="paid">Paid</option></select>
        <span className="text-sm text-zinc-600">{all.length.toLocaleString("en-US")} invoices{owed > 0 && <> · <b className="text-red-700">{money(owed)}</b> still owed</>}</span>
      </AutoForm>
      {rows.length === 0 ? <p className="mt-4 text-sm text-zinc-600">No invoice matches.</p> : (
        <div className="mt-3 overflow-x-auto rounded-lg">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup><col className="w-24" /><col className="w-24" /><col /><col className="w-48" /><col className="w-20" /><col className="w-24" /><col className="w-24" /><col className="w-20" /></colgroup>
            <thead><tr>{["Invoice", "Date", "Customer", "Shipment", "Type", "Total", "Balance", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.no} className="border-b border-zinc-100">
                <td className={`${td} font-semibold`}>{o.no}</td><td className={td}>{shortDate(o.date)}</td>
                <td className={`${td} truncate`} title={names.get(o.cust)}><Link href={`/warehouse/customers/${o.cust}`} className="hover:text-brand">{names.get(o.cust) ?? `Customer ${o.cust}`}</Link></td>
                <td className={`${td} truncate`} title={o.shipment}>{o.shipment || "–"}</td><td className={td}>{o.ship || "–"}</td><td className={td}>{money(o.total)}</td>
                <td className={`${td} font-medium ${oldOpen(o) ? "text-red-700" : "text-green-700"}`}>{oldOpen(o) ? money(oldBalance(o)) : "Paid"}</td>
                <td className={td}><Link href={`/warehouse/oldinvoices/${o.no}`} className="text-brand underline">Open</Link></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link href={link(page - 1)} className="text-brand underline">Previous</Link> : <span className="text-zinc-400">Previous</span>}
          <span>Page {page} of {pages}</span>
          {page < pages ? <Link href={link(page + 1)} className="text-brand underline">Next</Link> : <span className="text-zinc-400">Next</span>}
        </div>
      )}
    </main>
  );
}
