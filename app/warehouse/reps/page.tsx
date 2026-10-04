import Link from "next/link";
import { db } from "@/lib/wh-store";
import { addRep, saveRep, deleteRep } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Representatives · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1>Representatives</h1>
      <p className="text-sm text-zinc-600">A representative looks after a customer. Choose the representative on the customer&apos;s page; every new receipt for that customer starts with it (you can still change it on the receipt).</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      <form action={addRep} className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_7rem_auto]">
        <Input name="name" placeholder="Representative name" aria-label="Representative name" required />
        <Input name="initials" placeholder="Initials" maxLength={4} aria-label="Initials" />
        <Button type="submit">Add representative</Button>
      </form>

      {db.reps.length === 0 ? <p className="mt-6 text-sm text-zinc-600">No representatives yet.</p> : (
        <table className="mt-5 w-full text-left text-sm">
          <thead><tr>{["Name", "Initials", "Customers", "Receipts", "", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>{db.reps.map((r) => {
            const mine = db.customers.filter((c) => c.rep === r.id);
            return (
              <tr key={r.id} className="border-b border-zinc-100 align-top">
                <td className={td} colSpan={2}>
                  <form action={saveRep} className="flex gap-2"><input type="hidden" name="id" value={r.id} />
                    <Input name="name" defaultValue={r.name} aria-label={`Name of ${r.name}`} required />
                    <Input name="initials" defaultValue={r.initials} maxLength={4} className="w-24" aria-label={`Initials of ${r.name}`} required />
                    <Button type="submit" variant="outline">Save</Button>
                  </form>
                </td>
                <td className={td}>{mine.length === 0 ? "–" : mine.map((c, i) => <span key={c.no}>{i > 0 && ", "}<Link href={`/warehouse/customers/${c.no}`} className="text-brand underline">{c.name}</Link></span>)}</td>
                <td className={td}>{db.wrs.filter((w) => w.rep === r.id).length}</td>
                <td className={td} />
                <td className={td}><form action={deleteRep}><input type="hidden" name="id" value={r.id} /><button className="text-red-700 underline" aria-label={`Remove ${r.name}`}>Remove</button></form></td>
              </tr>);
          })}</tbody>
        </table>
      )}
    </main>
  );
}
