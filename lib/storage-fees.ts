// The storage fee of the terms ("after 30 days in our warehouse, a storage fee will be applied"), added by itself.
// A receipt whose pieces are still in Miami (not all loaded on a shipment) and not invoiced yet gets a "Storage fee" line (automatic):
// the fee of Administration > Fees & rates for every 30 days beyond the free period. It grows as the days pass and stops once the pieces ship.
import { db, r2, type WR } from "./wh-store";
import { daysSince } from "./clock";

export const STORAGE_LABEL = "Storage fee";
export const storageAmount = (w: WR, loaded: Set<number>): number => {
  const { storageFreeDays: free, storageFee: fee } = db.settings;
  if (!(fee > 0) || !w.pieces.length || w.invoice || w.estimate) return -1; // -1: nothing to add or change
  if (w.pieces.every((p) => loaded.has(p.no))) return -1; // shipped: it stops growing
  const days = daysSince(w.date);
  if (days <= free) return 0;
  return r2((Math.floor((days - free) / 30) + 1) * fee);
};

// Brings every receipt up to date. Returns how many receipts changed.
export function applyStorageFees(): number {
  const loaded = new Set(db.loads.map((l) => l.no));
  let changed = 0;
  for (const w of db.wrs) {
    const amount = storageAmount(w, loaded), line = w.fees.find((f) => f.auto === "storage");
    if (amount < 0) { if (line && !(db.settings.storageFee > 0) && !w.invoice) { w.fees = w.fees.filter((f) => f !== line); changed++; } continue; }
    if (amount === 0) continue;
    if (line) { if (line.amount !== amount) { line.amount = amount; changed++; } }
    else { w.fees.push({ id: db.n.fee++, label: STORAGE_LABEL, amount, kind: "charge", auto: "storage" }); changed++; }
  }
  return changed;
}

// At most every 10 minutes, called from the layout (every request): no timer needed.
let lastRun = 0;
export function storageFeesDue(): boolean { if (Date.now() - lastRun < 600_000) return false; lastRun = Date.now(); return true; }
