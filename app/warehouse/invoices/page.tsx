import Link from "next/link";
import { db, total, paidAmt, balance, money, wrCode, repLabel } from "@/lib/wh-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Invoices · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const sel = "h-9 rounded-md border bg-white px-2 text-sm";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const cust = (q.customer ?? "").trim().toLowerCase();
  const rows = db.wrs.filter((w) => w.invoice
    && (!q.ship || w.ship === q.ship)
    && (!q.rep || w.rep === q.rep)
    && (!cust || w.customer.toLowerCase().includes(cust) || String(w.cust) === cust)
    && (!q.status || (q.status === "paid" ? balance(w) <= 0 : balance(w) > 0)));
  const sum = (f: (w: (typeof rows)[number]) => number) => rows.reduce((a, w) => a + f(w), 0);
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1>Invoices</h1>
      <p className="text-sm text-zinc-600">A receipt becomes an invoice when you press &quot;Create invoice&quot; on it. Payments are added on the receipt.</p>
      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <select name="ship" defaultValue={q.ship ?? ""} className={sel} aria-label="Ship type"><option value="">All ship types</option><option value="Air">Air (JPF)</option><option value="Ocean">Ocean (JPL)</option></select>
        <select name="rep" defaultValue={q.rep ?? ""} className={sel} aria-label="Representative"><option value="">All representatives</option>{db.reps.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.initials})</option>)}</select>
        <select name="status" defaultValue={q.status ?? ""} className={sel} aria-label="Status"><option value="">Paid and unpaid</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select>
        <Input name="customer" defaultValue={q.customer} placeholder="Customer name or number" className="w-56" aria-label="Customer" />
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      {rows.length === 0 ? <p className="mt-6 text-sm text-zinc-600">No invoices match.</p> : (
        <table className="mt-4 w-full text-left text-sm">
          <thead><tr>{["Invoice", "Shipment", "Receipt", "Bill To", "Rep", "Amount", "Paid", "Balance", "", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((w) => (
            <tr key={w.id} className="border-b border-zinc-100">
              <td className={`${td} font-semibold`}>{w.invoice}</td>
              <td className={td}>{db.loads.find((l) => l.wr === w.id)?.shipment ?? "–"}</td>
              <td className={td}>{wrCode(w)}</td><td className={td}>{w.customer}</td><td className={td}>{repLabel(w.rep) || "–"}</td>
              <td className={td}>{money(total(w))}</td><td className={td}>{money(paidAmt(w))}</td>
              <td className={`${td} font-medium ${balance(w) > 0 ? "text-red-700" : "text-green-700"}`}>{money(balance(w))}</td>
              <td className={td}><Link href={`/warehouse/invoices/${w.invoice}`} className="text-brand underline">Invoice</Link></td>
              <td className={`${td} space-x-3`}><Link href={`/warehouse/receipts/${w.id}`} className="text-brand underline">Pay</Link><Link href={`/warehouse/receipts/${w.id}/report`} className="text-brand underline">Receipt</Link></td>
            </tr>))}</tbody>
          <tfoot><tr className="font-semibold"><td className={td} colSpan={5}>{rows.length} invoice{rows.length > 1 ? "s" : ""}</td><td className={td}>{money(sum(total))}</td><td className={td}>{money(sum(paidAmt))}</td><td className={td}>{money(sum(balance))}</td><td colSpan={2} /></tr></tfoot>
        </table>
      )}
    </main>
  );
}
