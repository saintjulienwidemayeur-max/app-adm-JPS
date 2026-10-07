import Link from "next/link";
import { db, cargoOf } from "@/lib/wh-store";
import { createShipment } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Shipments · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const enc = encodeURIComponent;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const rows = [...db.shipments].reverse();
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Shipments</h1>
      <p className="text-sm text-zinc-600">One shipment = one flight or one boat. Pieces are loaded on it from Load pallet. Open a shipment to fill in its booking and print the Bill of Lading, the Shipper&apos;s Letter of Instruction and the cargo list.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      <form action={createShipment} className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_8rem_auto]">
        <Input name="name" placeholder="New shipment name, for example PL-AIR-10-06-2026" aria-label="Shipment name" required />
        <select name="ship" className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Ship type"><option>Air</option><option>Ocean</option></select>
        <Button type="submit">Create shipment</Button>
      </form>
      {rows.length === 0 ? <p className="mt-6 text-sm text-zinc-600">No shipments yet. Create one above, or load a first piece on Load pallet.</p> : (
        <table className="mt-5 w-full text-left text-sm">
          <thead><tr>{["Shipment", "Ship", "Cargo ID", "Created", "Status", "Pieces", "Lbs", "Documents"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((sh) => {
            const c = cargoOf(sh.name), base = `/warehouse/shipments/${enc(sh.name)}`;
            return (
              <tr key={sh.name} className="border-b border-zinc-100">
                <td className={`${td} font-semibold`}><Link href={base} className="text-brand underline">{sh.name}</Link></td><td className={td}>{sh.ship}</td><td className={td}>{sh.cargoId}</td><td className={td}>{sh.date}</td>
                <td className={td}>{sh.shipped ? <span className="text-green-700">Shipped {sh.shipped}</span> : "Open"}</td><td className={td}>{c.rows.length}</td><td className={td}>{c.lbs}</td>
                <td className={`${td} space-x-3`}><Link href={base} className="text-brand underline">Booking</Link><Link href={`${base}/bol`} className="text-brand underline">BOL</Link><Link href={`${base}/sli`} className="text-brand underline">Letter</Link><Link href={`${base}/cargo`} className="text-brand underline">Cargo list</Link></td>
              </tr>);
          })}</tbody>
        </table>
      )}
    </main>
  );
}
