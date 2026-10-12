"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

// Filters that apply by themselves: choosing Air/Ocean filters at once, typing in the search box filters after a short pause.
export function ReceiptFilters({ q: initialQ, ship: initialShip }: { q: string; ship: string }) {
  const router = useRouter(), path = usePathname();
  const [q, setQ] = useState(initialQ), [ship, setShip] = useState(initialShip);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (ship) p.set("ship", ship);
      router.replace(p.size ? `${path}?${p}` : path, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [q, ship, path, router]);
  return (
    <form onSubmit={(e) => e.preventDefault()} className="mt-3 flex flex-wrap items-center gap-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search customer, number or receipt" className="w-64" aria-label="Search receipts" autoComplete="off" />
      <select value={ship} onChange={(e) => setShip(e.target.value)} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Ship type">
        <option value="">Air and Ocean</option><option value="Air">Air (JPF)</option><option value="Ocean">Ocean (JPL)</option>
      </select>
      {(q || ship) && <button type="button" onClick={() => { setQ(""); setShip(""); }} className="text-sm text-brand underline">Clear</button>}
    </form>
  );
}
