import Link from "next/link";
import { db } from "@/lib/wh-store";
import { singlePiece, combinePieces } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Consolidate · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

function Fields() {
  return (
    <>
      <Input name="customer" list="cust" placeholder="Customer (name, box JPS-1234 or e-mail)" className="min-w-56 flex-1" required />
      <select name="ship" aria-label="Ship type" className="h-9 rounded-md border bg-white px-2 text-sm"><option>Air</option><option>Ocean</option></select>
      <Input name="type" placeholder="Type (BOX - OTHER)" className="w-40" />
      {["l", "w", "h", "lbs"].map((k) => <Input key={k} name={k} type="number" step="any" min="0" placeholder={k === "lbs" ? "lb" : k.toUpperCase()} aria-label={k} className="w-16" required />)}
    </>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const open = db.items.filter((i) => !i.piece);
  const customers = [...new Set(db.wrs.map((w) => w.customer))];
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Consolidate</h1>
      <p className="text-sm text-zinc-600">A parcel that ships alone gets its own JP&apos;s piece number and label. Several parcels for the same customer share one new piece.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{q.err}</p>}
      {q.ok && (
        <p className="mt-2 text-sm font-medium text-green-700">{q.ok}{" "}
          {q.wr && <Link href={`/warehouse/receipts/${q.wr}/labels${q.piece ? `?only=${q.piece}` : ""}`} className="text-brand underline">Print the label</Link>}
        </p>
      )}
      {q.warn && <p role="alert" className="mt-1 text-sm font-medium text-amber-700">{q.warn}</p>}
      <datalist id="cust">{customers.map((c) => <option key={c} value={c} />)}</datalist>

      <h2 className="mt-5 font-bold">Parcels waiting ({open.length})</h2>
      {open.length === 0 ? <p className="mt-1 text-sm text-zinc-600">Nothing to consolidate. Scan parcels on Received items first.</p> : (
        <>
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr>{["", "Date", "Carrier", "Tracking", "Ships alone"].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>{open.map((i) => (
              <tr key={i.id} className="border-b border-zinc-100 align-top">
                <td className={td}><input type="checkbox" form="combine" name="id" value={i.id} aria-label={`Select ${i.tracking}`} /></td>
                <td className={td}>{i.date}</td><td className={td}>{i.carrier}</td><td className={`${td} font-mono text-xs`}>{i.tracking}</td>
                <td className={td}><details><summary className="cursor-pointer text-brand underline">Make its own piece</summary>
                  <form action={singlePiece} className="mt-1 flex max-w-xl flex-wrap gap-1"><input type="hidden" name="id" value={i.id} /><Fields /><Button type="submit">Create piece</Button></form>
                </details></td>
              </tr>))}</tbody>
          </table>
          <form id="combine" action={combinePieces} className="mt-4 rounded-lg border p-3">
            <h3 className="mb-2 text-sm font-semibold">Combine the selected parcels into one piece</h3>
            <div className="flex flex-wrap gap-1"><Fields /><Button type="submit">Combine into one piece</Button></div>
          </form>
        </>
      )}
    </main>
  );
}
