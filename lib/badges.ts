// Small counters shown next to menu entries (what is waiting for someone). Server only: reads the working copy.
import { db, balance } from "./wh-store";

export type Badges = Record<string, number>;
export function menuBadges(): Badges {
  const waiting = db.items.filter((i) => !i.piece).length;
  const b: Badges = {
    "/warehouse/prealerts": db.prealerts.filter((p) => p.status === "Expected").length,
    "/warehouse/consolidate": waiting,
    "/warehouse/pickups": db.pickups.filter((p) => p.status === "Scheduled").length,
    "/billing": db.wrs.filter((w) => w.invoice && balance(w) > 0).length,
    "/warehouse/shipments": db.shipments.filter((s) => !s.shipped).length,
  };
  return b;
}
export const owed = () => Math.round(db.wrs.filter((w) => w.invoice).reduce((a, w) => a + Math.max(0, balance(w)), 0) * 100) / 100;
