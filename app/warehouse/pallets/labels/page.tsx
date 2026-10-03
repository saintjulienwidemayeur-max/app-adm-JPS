import { db, findPiece, chargeable, r2 } from "@/lib/wh-store";
import { Labels } from "@/components/wh-labels";

export default async function Page({ searchParams }: { searchParams: Promise<{ shipment?: string }> }) {
  const { shipment = "" } = await searchParams;
  const sh = db.shipments.find((x) => x.name === shipment);
  const loads = db.loads.filter((l) => l.shipment === shipment);
  const names = [...new Set(loads.map((l) => l.pallet))];
  const labels = names.map((name) => {
    const ps = loads.filter((l) => l.pallet === name).map((l) => findPiece(l.no)!.p);
    const lbs = r2(ps.reduce((a, p) => a + p.lbs, 0));
    return {
      code: `${shipment}|${name}`, ship: sh?.ship ?? "Air", route: `Cargo ${sh?.cargoId ?? ""}`,
      rows: [["Pieces", String(ps.length)], ["Weight", `${lbs} lb`], ["Chargeable", `${r2(ps.reduce((a, p) => a + chargeable(p), 0))} lb`], ["Weight", `${r2(lbs * 0.45359)} KG`]] as [string, string][],
    };
  });
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {labels.length ? <Labels labels={labels} /> : <p className="text-sm text-zinc-600">Nothing loaded on this shipment yet.</p>}
    </main>
  );
}
