import Link from "next/link";
import { db } from "@/lib/wh-store";
import { requireAdmin } from "@/lib/users";
import { tryLoaded, flush } from "@/lib/persist";
import { syncSiteClients } from "@/lib/site-clients";
import { siteClients, siteAccountStats, syncEnabled } from "@/lib/jps-sync";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Website sign-ups · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1 align-top";
const PER = 50;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US");

// Everyone who created an account on the website, newest first, with the Customers record each one became.
export default async function Page({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const q = await searchParams, needle = (q.q ?? "").toLowerCase();
  const site = (await tryLoaded()) ? await syncSiteClients(true) : { added: 0, error: undefined as string | undefined };
  await flush();
  const rows = syncEnabled() ? await siteClients() : { rows: [], error: undefined as string | undefined };
  const stats = rows.rows.length ? await siteAccountStats() : null;
  const byClient = new Map(db.customers.filter((c) => c.clientId).map((c) => [c.clientId!, c]));
  const all = [...rows.rows].reverse().filter((r) => !needle || `${r.name} ${r.email} ${r.phone ?? ""} ${r.box_number ?? ""}`.toLowerCase().includes(needle));
  const pages = Math.max(1, Math.ceil(all.length / PER)), page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const shown = all.slice((page - 1) * PER, page * PER);
  const week = Date.now() - 7 * 86_400_000, fresh = rows.rows.filter((r) => new Date(r.created_at).getTime() > week).length;
  const link = (p: number) => `/settings/signups?${new URLSearchParams({ ...(q.q && { q: q.q }), page: String(p) })}`;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1>Website sign-ups</h1>
      <p className="text-sm text-zinc-600">Everyone who created an account on jpslogistics.me. Each one is added to <Link href="/warehouse/customers" className="text-brand underline">Customers</Link> by itself (the website is checked every few minutes, and every time you open this page).</p>
      {!syncEnabled() && <p role="alert" className="mt-3 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900">The website is not connected (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).</p>}
      {(site.error || rows.error) && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{site.error ?? rows.error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <span><b className="text-2xl text-brand">{rows.rows.length}</b> accounts</span>
        <span><b className="text-2xl text-green-700">{fresh}</b> in the last 7 days</span>
        {site.added > 0 && <span className="font-semibold text-green-700">{site.added} new customer(s) just added to Customers</span>}
      </div>
      <form className="mt-4 flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={q.q} placeholder="Search name, e-mail, phone or box" className="max-w-72" aria-label="Search" />
        <Button type="submit" variant="outline">Search</Button>
        <Link href="/settings/signups" className="text-sm text-brand underline">Check the website now</Link>
      </form>
      {shown.length === 0 ? <p className="mt-4 text-sm text-zinc-600">No account yet.</p> : (
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>{["Joined", "Name", "E-mail", "Phone", "Box", "Lang", "Last sign-in", "Alerts", "Customers"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{shown.map((r) => {
            const c = byClient.get(r.id), isNew = new Date(r.created_at).getTime() > week, last = stats?.login.get(r.id);
            return (
              <tr key={r.id} className="border-b border-zinc-100">
                <td className={`${td} whitespace-nowrap`}>{day(r.created_at)}{isNew && <span className="ml-1.5 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">New</span>}</td>
                <td className={td}>{r.name}</td><td className={`${td} break-all`}>{r.email}</td><td className={`${td} whitespace-nowrap`}>{r.phone || "–"}</td>
                <td className={td}>{r.box_number || "–"}</td><td className={td}>{(r.lang ?? "fr").toUpperCase()}</td>
                <td className={`${td} whitespace-nowrap`}>{last ? day(last) : stats?.loginTracking === false ? "n/a" : "never"}</td>
                <td className={td}>{stats?.push.has(r.id) ? "App on" : "–"}</td>
                <td className={td}>{c ? <Link href={`/warehouse/customers/${c.no}`} className="text-brand underline">#{c.no} · Open</Link> : <span className="text-amber-700">not added yet</span>}</td>
              </tr>);
          })}</tbody>
        </table></div>
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
