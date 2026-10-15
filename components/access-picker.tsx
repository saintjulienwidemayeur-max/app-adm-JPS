"use client";
import { useState } from "react";

type Group = { slug: string; title: string; pages: { href: string; label: string }[] };
// Which pages a person may open: one checkbox per page, grouped by section, with "all" for a section.
export function AccessPicker({ groups, selected }: { groups: Group[]; selected: string[] }) {
  const [on, setOn] = useState(() => new Set(selected));
  const toggle = (hrefs: string[], value: boolean) => setOn((cur) => { const n = new Set(cur); hrefs.forEach((h) => (value ? n.add(h) : n.delete(h))); return n; });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((g) => {
        const hrefs = g.pages.map((p) => p.href), all = hrefs.every((h) => on.has(h));
        return (
          <fieldset key={g.slug} className="rounded-lg border border-zinc-200 bg-white p-3">
            <legend className="px-1 text-sm font-bold text-brand">{g.title}</legend>
            <label className="flex items-center gap-2 border-b border-zinc-100 pb-1.5 text-xs font-semibold text-zinc-600"><input type="checkbox" checked={all} onChange={(e) => toggle(hrefs, e.target.checked)} /> All of {g.title}</label>
            <div className="mt-1.5 grid gap-1">{g.pages.map((p) => (
              <label key={p.href} className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm" value={p.href} checked={on.has(p.href)} onChange={(e) => toggle([p.href], e.target.checked)} /> {p.label}</label>))}</div>
          </fieldset>);
      })}
    </div>
  );
}
