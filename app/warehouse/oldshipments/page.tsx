import Link from "next/link";
import { db, money } from "@/lib/wh-store";
import { AutoForm } from "@/components/auto-form";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Old shipments · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const PER = 25;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams, needle = (q.q ?? "").trim().toLowerCase();
  const all = db.oldShips.filter((s) => (!q.s || s.type.toLowerCase() === q.s.toLowerCase()) && (!needle || `${s.name} ${s.awb} ${s.bol} ${s.container} ${s.line} ${s.vessel}`.toLowerCase().includes(needle)));
  const sorted = [...all].reverse();
  const pages = Math.max(1, Math.ceil(sorted.length / PER)), page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const rows = sorted.slice((page - 1) * PER, page * PER);
  const types = [...new Set(db.oldShips.map((s) => s.type).filter(Boolean))].sort();
  const link = (p: number) => `/warehouse/oldshipments?${new URLSearchParams({ ...(q.q && { q: q.q }), ...(q.s && { s: q.s }), page: String(p) })}`;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1>Old shipments</h1>
      <p className="text-sm text-zinc-600">The shipments (bills of lading) of the old system, for reference.{db.oldShips.length === 0 && <> Nothing here yet: import them (Administration &gt; Import data &gt; Cargo history).</>}</p>
      <AutoForm className="mt-4 flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={q.q} placeholder="Name, AWB, container, line or vessel" className="w-72" aria-label="Search old shipments" />
        <select name="s" defaultValue={q.s ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Type"><option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        <span className="text-sm text-zinc-600">{all.length.toLocaleString("en-US")} shipments</span>
      </AutoForm>
      {rows.length > 0 && (
        <table className="mt-3 w-full table-fixed text-left text-sm">
          <colgroup><col className="w-64" /><col className="w-20" /><col className="w-24" /><col className="w-24" /><col /><col className="w-20" /><col className="w-24" /></colgroup>
          <thead><tr>{["Shipment", "Type", "Date", "Sailed", "Line / vessel", "Pieces", "Cost"].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((s) => <tr key={s.id} className="border-b border-zinc-100"><td className={`${td} truncate font-medium`} title={s.name}><Link href={`/warehouse/oldshipments/${s.id}`} className="text-brand underline">{s.name || s.id}</Link></td><td className={td}>{s.type}</td><td className={td}>{s.date || "–"}</td><td className={td}>{s.sail || "–"}</td><td className={`${td} truncate`}>{[s.line, s.vessel].filter(Boolean).join(" · ") || "–"}</td><td className={td}>{s.items.length}</td><td className={td}>{s.cost ? money(s.cost) : "–"}</td></tr>)}</tbody>
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
