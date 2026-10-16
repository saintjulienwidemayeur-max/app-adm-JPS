import Link from "next/link";
import { db, money } from "@/lib/wh-store";
import { AutoForm } from "@/components/auto-form";
import { Input } from "@/components/ui/input";
import { extractTracking } from "@/lib/tracking";

export const metadata = { title: "Old receipts · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const PER = 25;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams, raw = (q.q ?? "").trim(), needle = raw.toLowerCase(), track = raw.length >= 8 ? extractTracking(raw).slice(-12) : "", cno = Number(q.c) || 0;
  const names = new Map(db.customers.map((c) => [c.no, c.name]));
  const all = db.oldWrs.filter((w) => (!cno || w.cust === cno || w.billTo === cno) && (!q.s || w.ship.toLowerCase() === q.s.toLowerCase()) &&
    (!needle || w.wr === needle || `${w.shipper} ${w.contents} ${names.get(w.cust) ?? ""} ${w.cust}`.toLowerCase().includes(needle) || (track && w.scans.some((s) => s.t.endsWith(track)))));
  const sorted = [...all].reverse(); // newest first
  const pages = Math.max(1, Math.ceil(sorted.length / PER)), page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const rows = sorted.slice((page - 1) * PER, page * PER);
  const types = [...new Set(db.oldWrs.map((w) => w.ship).filter(Boolean))].sort();
  const link = (p: number) => `/warehouse/oldreceipts?${new URLSearchParams({ ...(q.q && { q: q.q }), ...(q.s && { s: q.s }), ...(cno && { c: String(cno) }), page: String(p) })}`;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1>Old receipts</h1>
      <p className="text-sm text-zinc-600">The warehouse receipts of the old system, for reference.{db.oldWrs.length === 0 ? <> Nothing here yet: import them (Administration &gt; Import data &gt; Cargo history).</> : <> {db.oldWrs.length.toLocaleString("en-US")} receipts. Search by receipt number, customer, contents or a tracking number.</>}</p>
      {cno > 0 && <p className="mt-2 text-sm">Customer <b>{names.get(cno) ?? cno}</b> · <Link href="/warehouse/oldreceipts" className="text-brand underline">show everyone</Link></p>}
      <AutoForm className="mt-4 flex flex-wrap items-center gap-2">
        {cno > 0 && <input type="hidden" name="c" value={cno} />}
        <Input name="q" defaultValue={q.q} placeholder="Receipt no., customer, contents or tracking number" className="w-80" aria-label="Search old receipts" />
        <select name="s" defaultValue={q.s ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Ship type"><option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        <span className="text-sm text-zinc-600">{all.length.toLocaleString("en-US")} receipts</span>
      </AutoForm>
      {rows.length > 0 && (
        <table className="mt-3 w-full table-fixed text-left text-sm">
          <colgroup><col className="w-20" /><col className="w-24" /><col /><col className="w-24" /><col className="w-16" /><col className="w-24" /><col /></colgroup>
          <thead><tr>{["Receipt", "Date", "Customer", "Type", "Pieces", "Fees", "Contents"].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((w) => (
            <tr key={w.wr} className="border-b border-zinc-100">
              <td className={`${td} font-semibold`}><Link href={`/warehouse/oldreceipts/${w.wr}`} className="text-brand underline">{w.wr}</Link></td><td className={td}>{w.date}</td>
              <td className={`${td} truncate`} title={names.get(w.cust)}><Link href={`/warehouse/customers/${w.cust}`} className="hover:text-brand">{names.get(w.cust) ?? w.shipper ?? `Customer ${w.cust}`}</Link> <span className="text-xs text-zinc-500">#{w.cust}</span></td>
              <td className={td}>{w.ship}</td><td className={td}>{w.pieces.length}</td><td className={td}>{money(w.handling + w.other)}</td><td className={`${td} truncate`} title={w.contents}>{w.contents || "–"}</td>
            </tr>))}</tbody>
        </table>
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
