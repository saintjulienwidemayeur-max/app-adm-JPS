import Link from "next/link";
import { db } from "@/lib/wh-store";
import { requireAdmin } from "@/lib/users";
import { AutoForm } from "@/components/auto-form";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Activity log · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1 align-top";
const PER = 50;

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const q = await searchParams, needle = (q.q ?? "").trim().toLowerCase();
  const users = [...new Set([...db.users.map((u) => u.name), ...db.audit.map((a) => a.user)])].sort((a, b) => a.localeCompare(b));
  const all = db.audit.filter((a) => (!q.user || a.user === q.user) && (!q.only || (q.only === "problems" ? !a.result.startsWith("ok") && !a.result.startsWith("sent") : true)) && (!needle || `${a.action} ${a.detail} ${a.result}`.toLowerCase().includes(needle)));
  const pages = Math.max(1, Math.ceil(all.length / PER)), page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const rows = all.slice((page - 1) * PER, page * PER);
  const link = (p: number) => `/settings/activity?${new URLSearchParams({ ...(q.user && { user: q.user }), ...(q.q && { q: q.q }), ...(q.only && { only: q.only }), page: String(p) })}`;
  // Who was last active, for each person.
  const last = new Map<string, { when: string; n: number }>();
  for (const a of db.audit) { const e = last.get(a.user); last.set(a.user, { when: e?.when ?? `${a.date} ${a.time}`, n: (e?.n ?? 0) + 1 }); }
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1>Activity log</h1>
      <p className="text-sm text-zinc-600">Everything each person does in the app: who, when, which action, with what, and how it ended. Sign-ins (and wrong codes), every change, imports, e-mails and invitations are listed. Codes and passwords are never written. The last {db.audit.length.toLocaleString("en-US")} entries are kept.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...last].slice(0, 8).map(([name, e]) => (
          <Link key={name} href={`/settings/activity?user=${encodeURIComponent(name)}`} className="rounded-xl border border-[#dfe4f0] bg-white px-3 py-2 shadow-sm hover:border-brand">
            <div className="truncate text-sm font-bold text-brand">{name}</div><div className="text-xs text-zinc-600">{e.n} actions · last {e.when}</div>
          </Link>))}
      </div>
      <AutoForm className="mt-4 flex flex-wrap items-center gap-2">
        <select name="user" defaultValue={q.user ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Person"><option value="">Everyone</option>{users.map((u) => <option key={u}>{u}</option>)}</select>
        <select name="only" defaultValue={q.only ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Kind"><option value="">Everything</option><option value="problems">Refused or failed only</option></select>
        <Input name="q" defaultValue={q.q} placeholder="Search an action or a detail" className="w-64" aria-label="Search the log" />
        <span className="text-sm text-zinc-600">{all.length.toLocaleString("en-US")} entries</span>
      </AutoForm>
      {rows.length === 0 ? <p className="mt-4 text-sm text-zinc-600">Nothing logged yet.</p> : (
        <div className="mt-3 overflow-x-auto rounded-lg">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup><col className="w-36" /><col className="w-28" /><col className="w-48" /><col /><col className="w-56" /></colgroup>
            <thead><tr>{["When", "Who", "Action", "With", "Result"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100">
                <td className={td}>{a.date} {a.time}</td><td className={`${td} font-semibold`}>{a.user}</td><td className={`${td} capitalize`}>{a.action}</td>
                <td className={`${td} break-words text-xs text-zinc-700`}>{a.detail || "–"}</td>
                <td className={`${td} break-words text-xs ${a.result.startsWith("refused") || a.result.startsWith("error") ? "font-medium text-red-700" : "text-zinc-600"}`}>{a.result}</td>
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
