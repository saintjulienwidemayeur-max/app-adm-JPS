"use server";
import { redirect } from "next/navigation";
import { db, DESTINATIONS } from "./wh-store";
import { act } from "./act";
import { requireAdmin } from "./users";
import { applyStorageFees } from "./storage-fees";

const PAGE = "/settings/fees";
export const saveFeeSettings = act("saveFeeSettings", async (f: FormData) => {
  await requireAdmin();
  const days = Number(f.get("storageFreeDays")), fee = Number(f.get("storageFee"));
  if (!Number.isFinite(days) || days < 0 || days > 365) redirect(`${PAGE}?err=${encodeURIComponent("Free days: a number from 0 to 365.")}`);
  if (!Number.isFinite(fee) || fee < 0 || fee > 10000) redirect(`${PAGE}?err=${encodeURIComponent("Storage fee: 0 or more (0 switches the automatic fee off).")}`);
  db.settings.storageFreeDays = Math.round(days); db.settings.storageFee = Math.round(fee * 100) / 100;
  const n = applyStorageFees();
  redirect(`${PAGE}?ok=${encodeURIComponent(`Saved. ${n} receipt${n === 1 ? "" : "s"} updated.`)}`);
});

// The rates of each destination (Air per lb, Ocean per cubic foot).
export const saveRates = act("saveRates", async (f: FormData) => {
  await requireAdmin();
  const rates: Record<string, { air: number; ocean: number }> = {};
  for (const [i, d] of DESTINATIONS.entries()) {
    const air = Number(f.get(`air_${i}`)), ocean = Number(f.get(`ocean_${i}`));
    if (!Number.isFinite(air) || air <= 0 || air > 1000 || !Number.isFinite(ocean) || ocean <= 0 || ocean > 1000) redirect(`${PAGE}?err=${encodeURIComponent(`${d}: enter an Air and an Ocean rate more than 0.`)}`);
    rates[d] = { air: Math.round(air * 100) / 100, ocean: Math.round(ocean * 100) / 100 };
  }
  db.settings.rates = rates;
  redirect(`${PAGE}?ok=${encodeURIComponent("Rates saved. They apply to the receipts made from now on and when a receipt's destination or ship type is changed. Receipts already made keep their rate.")}`);
});

// Haiti -> Miami on the website: when ticked, parcels going to the USA get their tracking (status and push) on the website like the others.
export const saveSiteDirection = act("saveSiteDirection", async (f: FormData) => {
  await requireAdmin();
  db.settings.siteDirection = f.get("siteDirection") === "on";
  redirect(`${PAGE}?ok=${encodeURIComponent(db.settings.siteDirection ? "Saved: parcels going to the USA now appear on the website's tracking." : "Saved: parcels going to the USA are only e-mailed from here.")}`);
});
