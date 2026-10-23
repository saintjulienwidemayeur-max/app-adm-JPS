import Link from "next/link";
import { db } from "@/lib/wh-store";
import { createCustomer } from "@/lib/wh-actions";
import { syncSiteClients } from "@/lib/site-clients";
import { currentUser } from "@/lib/users";
import { emailProblem, PROBLEM_TEXT } from "@/lib/mailrules";
import { tryLoaded, flush } from "@/lib/persist";
import { CustomerFields } from "@/components/customer-fields";
import { AutoForm } from "@/components/auto-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Customers · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const PER = 25;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const site = (await tryLoaded()) ? await syncSiteClients() : { added: 0, error: undefined }; // accounts created on the website appear here by themselves
  await flush();
  const me = await currentUser();
  const q = await searchParams;
  const needle = (q.q ?? "").trim().toLowerCase();
  const fix = q.fix === "1";
  const needFix = db.customers.reduce((a, c) => a + (emailProblem(c) ? 1 : 0), 0);
  const all = db.customers.filter((c) => (!fix || emailProblem(c)) && (!needle || [String(c.no), c.name, c.phone, c.email, c.emailMore ?? "", c.consignee, c.box ?? ""].some((v) => v.toLowerCase().includes(needle))));
  const pages = Math.max(1, Math.ceil(all.length / PER));
  const page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const rows = all.slice((page - 1) * PER, page * PER);
  const wrCount = new Map<number, number>();
  for (const w of db.wrs) wrCount.set(w.cust, (wrCount.get(w.cust) ?? 0) + 1);
  const link = (p: number) => `/warehouse/customers?${new URLSearchParams({ ...(q.q && { q: q.q }), ...(fix && { fix: "1" }), page: String(p) })}`;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1>Customers</h1>
      <p className="text-sm text-zinc-600">The customer number (1001, 1002, ...) is printed on every label. A customer is also created automatically the first time you type a new name on Consolidate or on a receipt.</p>
      {me?.admin && <p className="mt-2 text-sm"><Link href="/settings/import" className="font-semibold text-brand underline">Import the customers of the old system (CSV)</Link></p>}
      {site.error && <p role="alert" className="mt-2 text-xs font-medium text-amber-700">Could not read the website accounts ({site.error}).</p>}
      {site.added > 0 && <p className="mt-2 text-sm font-medium text-green-700">{site.added} new customer{site.added > 1 ? "s" : ""} from the website.</p>}
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      <p className="mt-2 text-sm">{fix ? <><b>Customers waiting for a real e-mail.</b> <Link href="/warehouse/customers" className="text-brand underline">Show everyone</Link></> : <Link href="/warehouse/customers?fix=1" className="text-brand underline">{needFix} customers need a real e-mail (missing, shared or company address): they are not e-mailed</Link>}</p>
      <AutoForm className="mt-4 flex items-center gap-3">
        {fix && <input type="hidden" name="fix" value="1" />}
        <Input name="q" defaultValue={q.q} placeholder="Search by number, name, phone, email, box or consignee" aria-label="Search customers" className="max-w-md" autoFocus />
        <span className="text-sm text-zinc-600">{all.length === db.customers.length ? `${all.length} customers` : `${all.length} of ${db.customers.length}`}</span>
      </AutoForm>

      {rows.length === 0 ? <p className="mt-4 text-sm text-zinc-600">{db.customers.length ? "No customer matches your search." : "No customers yet. Add the first one below."}</p> : (
        <div className="mt-4 overflow-x-auto rounded-lg">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup><col className="w-16" /><col /><col className="w-24" /><col className="w-40" /><col className="w-56" /><col className="w-28" /><col className="w-20" /><col className="w-16" /></colgroup>
            <thead><tr>{["No.", "Name", "Box", "Phone", "Email", "Country", "Receipts", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.no} className="border-b border-zinc-100">
                <td className={`${td} font-semibold`}>{c.no}</td>
                <td className={`${td} truncate`} title={c.name}>{c.name}{c.clientId && <span className="ml-1.5 rounded bg-[#eaeefb] px-1.5 py-0.5 text-[10px] font-semibold text-brand">Website</span>}</td>
                <td className={`${td} truncate`}>{c.box || "–"}</td><td className={`${td} truncate`} title={c.phone}>{c.phone || "–"}</td><td className={`${td} truncate`} title={c.email}>{c.email || "–"}{emailProblem(c) && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-800" title={PROBLEM_TEXT[emailProblem(c) as "missing"]}>fix</span>}</td>
                <td className={`${td} truncate`}>{c.consigneeCountry}</td><td className={td}>{wrCount.get(c.no) ?? 0}</td>
                <td className={td}><Link href={`/warehouse/customers/${c.no}`} className="text-brand underline">Open</Link></td>
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

      <form action={createCustomer} className="mt-8 rounded-lg border p-3">
        <h2 className="mb-2 font-bold">New customer</h2>
        <CustomerFields />
        <Button type="submit" className="mt-4">Create customer</Button>
      </form>
    </main>
  );
}
