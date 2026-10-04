import Link from "next/link";
import { notFound } from "next/navigation";
import { db, wrCode, total, money, payStatus } from "@/lib/wh-store";
import { saveCustomer } from "@/lib/wh-actions";
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
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/warehouse/customers" className="text-sm text-brand underline">All customers</Link>
      <h1 className="mt-1">Customer {c.no} · {c.name}</h1>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      <form action={saveCustomer} className="mt-4 rounded-lg border p-3">
        <input type="hidden" name="no" value={c.no} />
        <CustomerFields c={c} />
        <Button type="submit" className="mt-4">Save customer</Button>
      </form>

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
