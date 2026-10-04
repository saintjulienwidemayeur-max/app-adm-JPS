import Link from "next/link";
import { db, repLabel } from "@/lib/wh-store";
import { createCustomer } from "@/lib/wh-actions";
import { CustomerFields } from "@/components/customer-fields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Customers · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const needle = (q.q ?? "").trim().toLowerCase();
  const rows = db.customers.filter((c) => !needle || [String(c.no), c.name, c.phone, c.email, c.consignee].some((v) => v.toLowerCase().includes(needle)));
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Customers</h1>
      <p className="text-sm text-zinc-600">The customer number (1001, 1002, ...) is printed on every label. A customer is also created automatically the first time you type a new name on Consolidate or on a receipt.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      <form method="get" className="mt-4 flex gap-2">
        <Input name="q" defaultValue={q.q} placeholder="Search by number, name, phone, email or consignee" aria-label="Search customers" />
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {rows.length === 0 ? <p className="mt-4 text-sm text-zinc-600">{db.customers.length ? "No customer matches your search." : "No customers yet. Add the first one below."}</p> : (
        <table className="mt-4 w-full text-left text-sm">
          <thead><tr>{["No.", "Name", "Phone", "Email", "Consignee", "Country", "Rep", "Receipts", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.no} className="border-b border-zinc-100">
              <td className={`${td} font-semibold`}>{c.no}</td><td className={td}>{c.name}</td><td className={td}>{c.phone || "–"}</td><td className={td}>{c.email || "–"}</td>
              <td className={td}>{c.consignee || "–"}</td><td className={td}>{c.consigneeCountry}</td><td className={td}>{repLabel(c.rep) || "–"}</td>
              <td className={td}>{db.wrs.filter((w) => w.cust === c.no).length}</td>
              <td className={td}><Link href={`/warehouse/customers/${c.no}`} className="text-brand underline">Open</Link></td>
            </tr>))}</tbody>
        </table>
      )}

      <form action={createCustomer} className="mt-8 rounded-lg border p-3">
        <h2 className="mb-2 font-bold">New customer</h2>
        <CustomerFields />
        <Button type="submit" className="mt-4">Create customer</Button>
      </form>
    </main>
  );
}
