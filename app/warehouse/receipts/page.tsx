import Link from "next/link";
import { db, total, payStatus, money, wrCode, repLabel } from "@/lib/wh-store";
import { createWR } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Warehouse receipts · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const needle = (q.q ?? "").trim().toLowerCase();
  const rows = db.wrs.filter((w) => (!q.rep || w.rep === q.rep) && (!q.ship || w.ship === q.ship)
    && (!needle || w.customer.toLowerCase().includes(needle) || String(w.cust) === needle || wrCode(w).toLowerCase().includes(needle)));
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Warehouse receipts</h1>
      <p className="text-sm text-zinc-600">JPF receipts ship by air, JPL by boat. Open a receipt to add pieces, fees, credits and payments.</p>
      <form action={createWR} className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.4fr_6rem_6rem_1fr_auto]">
        <Input name="customer" list="cust" placeholder="Customer (name or number; new names are added to Customers)" required />
        <Input name="route" placeholder="Route" maxLength={12} aria-label="Route" />
        <select name="ship" className="h-9 rounded-md border bg-white px-2 text-sm"><option>Air</option><option>Ocean</option></select>
        <Input name="comments" placeholder="Comments" />
        <Button type="submit">New receipt</Button>
        <datalist id="cust">{db.customers.map((c) => <option key={c.no} value={c.name}>{c.no}</option>)}</datalist>
      </form>
      <form method="get" className="mt-3 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q.q} placeholder="Search customer, number or receipt" className="w-64" aria-label="Search receipts" />
        <select name="ship" defaultValue={q.ship ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Ship type"><option value="">Air and Ocean</option><option value="Air">Air (JPF)</option><option value="Ocean">Ocean (JPL)</option></select>
        <select name="rep" defaultValue={q.rep ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Representative"><option value="">All representatives</option>{db.reps.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.initials})</option>)}</select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {rows.length === 0 ? <p className="mt-6 text-sm text-zinc-600">{db.wrs.length ? "No receipt matches the filter." : "No receipts yet. Create one for a customer above."}</p> : (
        <table className="mt-5 w-full text-left text-sm">
          <thead><tr>{["Receipt", "Date", "Customer", "Ship", "Rep", "Pieces", "Total", "Payment", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((w) => (
            <tr key={w.id} className="border-b border-zinc-100">
              <td className={`${td} font-semibold`}>{wrCode(w)}</td><td className={td}>{w.date}</td><td className={td}>{w.customer} <span className="text-xs text-zinc-500">#{w.cust}</span></td><td className={td}>{w.ship}</td>
              <td className={td}>{repLabel(w.rep) || "–"}</td><td className={td}>{w.pieces.length}</td><td className={td}>{money(total(w))}</td><td className={td}>{payStatus(w)}</td>
              <td className={td}><Link href={`/warehouse/receipts/${w.id}`} className="text-brand underline">Open</Link></td>
            </tr>))}</tbody>
        </table>
      )}
    </main>
  );
}
