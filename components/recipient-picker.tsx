"use client";
import { useState } from "react";

export type Recipient = { no: number; name: string; email: string; site: boolean };
// Choose customers: search, tick one by one, or tick everyone shown.
export function RecipientPicker({ people }: { people: Recipient[] }) {
  const [q, setQ] = useState(""), [on, setOn] = useState<Set<number>>(new Set());
  const shown = people.filter((p) => !q.trim() || `${p.no} ${p.name} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const set = (nos: number[], v: boolean) => setOn((cur) => { const n = new Set(cur); nos.forEach((x) => (v ? n.add(x) : n.delete(x))); return n; });
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search name, number or e-mail" aria-label="Search customers" className="h-9 w-64 rounded-md border border-zinc-300 px-3 text-sm" />
        <button type="button" onClick={() => set(shown.map((p) => p.no), true)} className="text-sm text-brand underline">Tick all shown ({shown.length})</button>
        <button type="button" onClick={() => setOn(new Set())} className="text-sm text-zinc-600 underline">Clear</button>
        <span className="ml-auto text-sm font-semibold">{on.size} chosen</span>
      </div>
      <div className="mt-2 max-h-72 overflow-y-auto rounded border border-zinc-100">
        {shown.length === 0 ? <p className="p-3 text-sm text-zinc-500">Nobody matches.</p> : shown.map((p) => (
          <label key={p.no} className={`flex items-center gap-2 border-b border-zinc-100 px-2 py-1.5 text-sm ${p.site ? "" : "opacity-50"}`}>
            <input type="checkbox" name="to" value={p.no} checked={on.has(p.no)} disabled={!p.site} onChange={(e) => set([p.no], e.target.checked)} />
            <span className="font-medium">{p.name}</span> <span className="text-xs text-zinc-500">#{p.no} · {p.email || "no e-mail"}{p.site ? "" : " · no website account"}</span>
          </label>))}
      </div>
    </div>
  );
}
