import Link from "next/link";
import { db, wrCode, r2 } from "@/lib/wh-store";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Loading sheet · JP's Logistics" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams, ship = q.ship === "Air" || q.ship === "Ocean" ? q.ship : "";
  const loaded = new Set(db.loads.map((l) => l.no));
  const groups = db.wrs.filter((w) => !ship || w.ship === ship).map((w) => ({ w, pieces: w.pieces.filter((p) => !loaded.has(p.no)) })).filter((g) => g.pieces.length);
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-14 w-auto" />
        <h1 className="flex-1 text-xl font-bold">Cargo loading sheet</h1><PrintButton />
      </div>
      <p className="no-print mb-3 text-sm">Waiting in the warehouse, not loaded yet: {[["", "Air and Ocean"], ["Air", "Air"], ["Ocean", "Ocean"]].map(([v, l]) => <Link key={v} href={v ? `?ship=${v}` : "?"} className={`mr-3 ${ship === v ? "font-bold" : "text-brand underline"}`}>{l}</Link>)}</p>
      {groups.length === 0 ? <p className="text-sm text-zinc-600">Nothing waiting in the warehouse. Add pieces to a warehouse receipt first.</p> : (
        <table className="w-full text-left text-sm">
          <thead className="border-b-2 border-black"><tr>{["WR", "", "Item", "Type", "Bill To"].map((h, i) => <th key={i} className="px-2 py-1 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{groups.flatMap(({ w, pieces }) => pieces.map((p, i) => (
            <tr key={p.no} className="border-b border-zinc-300">
              <td className="px-2 py-1 font-bold">{i === 0 ? wrCode(w) : ""}</td>
              <td className="px-2 py-1"><span className="inline-block h-4 w-4 border-2 border-black" /></td>
              <td className="px-2 py-1">{p.no}</td><td className="px-2 py-1">{p.type}</td><td className="px-2 py-1">{i === 0 ? w.customer : ""}</td>
            </tr>)))}</tbody>
          <tfoot><tr className="border-t-2 border-black font-semibold"><td className="px-2 py-1" colSpan={2}>{groups.length} receipts</td><td className="px-2 py-1" colSpan={3}>{groups.reduce((a, g) => a + g.pieces.length, 0)} pieces · {r2(groups.reduce((a, g) => a + g.pieces.reduce((b, p) => b + p.lbs, 0), 0))} lb</td></tr></tfoot>
        </table>
      )}
    </main>
  );
}
