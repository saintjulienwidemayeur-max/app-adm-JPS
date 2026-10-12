"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Est = { ship: string; unit: string; qty: number; rate: number; freight: number; handling: number; extra: number; insurance: number; credits: number; total: number };
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// "Compare" button on a receipt: what the same goods cost by the other method, with the existing data kept.
// Switching changes the receipt to the other method (new number JPF/JPL, standard rate and fees of that method).
export function CompareShip({ current, other, wr, locked, switchAction }: { current: Est; other: Est; wr: string; locked: boolean; switchAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const col = (e: Est) => (
    <div className="rounded-lg border p-3">
      <div className="font-bold">{e.ship}</div>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt>Freight ({e.qty} {e.unit} × {money(e.rate)})</dt><dd className="text-right">{money(e.freight)}</dd>
        {e.handling > 0 && <><dt>Handling fee</dt><dd className="text-right">{money(e.handling)}</dd></>}
        {e.extra > 0 && <><dt>Other fees on the receipt</dt><dd className="text-right">{money(e.extra)}</dd></>}
        {e.insurance > 0 && <><dt>Insurance</dt><dd className="text-right">{money(e.insurance)}</dd></>}
        {e.credits > 0 && <><dt>Credits</dt><dd className="text-right">−{money(e.credits)}</dd></>}
        <dt className="border-t pt-1 font-bold">Estimate</dt><dd className="border-t pt-1 text-right font-bold">{money(e.total)}</dd>
      </dl>
    </div>
  );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-100">Compare {current.ship} / {other.ship}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{wr}: {current.ship} or {other.ship}?</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">{col(current)}{col(other)}</div>
          <p className="mt-3 text-xs text-zinc-600">Estimate only, with the standard rates. Nothing changes until you switch. If the customer chooses {other.ship}, the receipt becomes {other.ship === "Ocean" ? "an Ocean (JPL)" : "an Air (JPF)"} receipt and the standard fees of that method are applied.</p>
          <div className="mt-3 flex gap-2">
            {locked ? <span className="text-xs text-red-700">Pieces are already loaded on a shipment: the method can&apos;t change.</span> : <form action={switchAction}><Button type="submit">Switch this receipt to {other.ship}</Button></form>}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
