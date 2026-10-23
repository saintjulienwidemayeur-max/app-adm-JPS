import { db } from "@/lib/wh-store";
import { Labels } from "@/components/wh-labels";

// Labels for the tracking numbers the system made for boxes that came with none: stick one on each box, then it can be scanned like any other parcel.
export default async function Page({ searchParams }: { searchParams: Promise<{ codes?: string }> }) {
  const codes = [...new Set(String((await searchParams).codes ?? "").split(",").map((x) => x.trim()).filter((x) => /^JPS\d{7}$/.test(x)))].slice(0, 200);
  const labels = codes.map((code) => { const i = db.items.find((x) => x.tracking === code); return { code, who: i?.customer, ship: i?.ship ?? "", rows: [["Received", i?.date ?? ""], ["Carrier", i?.carrier ?? ""]] as [string, string][] }; });
  return <main className="mx-auto max-w-3xl px-4 py-6">{labels.length ? <Labels labels={labels} /> : <p className="text-sm text-zinc-600">No label to print.</p>}</main>;
}
