import { notFound } from "next/navigation";
import { db, vol, cuft, labelCode } from "@/lib/wh-store";
import { Labels } from "@/components/wh-labels";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ only?: string }> }) {
  const { id } = await params;
  const only = Number((await searchParams).only) || 0;
  const w = db.wrs.find((x) => x.id === id);
  if (!w) notFound();
  const labels = w.pieces.filter((p) => !only || p.no === only).map((p) => ({
    code: labelCode(w, p), ship: w.ship, route: w.route,
    rows: [["Weight", `${p.lbs} lbs`], ["Size", `L ${p.l} × W ${p.w} × H ${p.h} in`], ["Volume", `${vol(p)} lbs`], ["Cuft", `${cuft(p)} cuft`]] as [string, string][],
  }));
  return <main className="mx-auto max-w-3xl px-4 py-6"><Labels labels={labels} /></main>;
}
