import Link from "next/link";
import { db, total, payStatus, money } from "@/lib/wh-store";
import { createWR } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Warehouse receipts · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const customers = [...new Set(db.wrs.map((w) => w.customer))];
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Warehouse receipts</h1>
      <p className="text-sm text-zinc-600">One receipt per customer. Open a receipt to add pieces, fees and payments.</p>
      <form action={createWR} className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.2fr_1.2fr_5rem_6rem_1fr_auto]">
        <Input name="customer" list="cust" placeholder="Customer (Bill To)" required />
        <Input name="email" type="email" placeholder="Customer email" />
        <Input name="route" placeholder="Route" maxLength={6} aria-label="Route code" />
        <select name="ship" className="h-9 rounded-md border bg-white px-2 text-sm"><option>Air</option><option>Ocean</option></select>
        <Input name="comments" placeholder="Comments" />
        <Button type="submit">New receipt</Button>
        <datalist id="cust">{customers.map((c) => <option key={c} value={c} />)}</datalist>
      </form>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {db.wrs.length === 0 ? <p className="mt-6 text-sm text-zinc-600">No receipts yet. Create one for a customer above.</p> : (
        <table className="mt-5 w-full text-left text-sm">
          <thead><tr>{["Receipt", "Date", "Customer", "Ship", "Pieces", "Estimated total", "Payment", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{db.wrs.map((w) => (
            <tr key={w.id} className="border-b border-zinc-100">
              <td className={`${td} font-semibold`}>JPF-{w.id}</td><td className={td}>{w.date}</td><td className={td}>{w.customer}</td><td className={td}>{w.ship}</td>
              <td className={td}>{w.pieces.length}</td><td className={td}>{money(total(w))}</td><td className={td}>{payStatus(w)}</td>
              <td className={td}><Link href={`/warehouse/receipts/${w.id}`} className="text-brand underline">Open</Link></td>
            </tr>))}</tbody>
        </table>
      )}
    </main>
  );
}
