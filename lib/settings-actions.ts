"use server";
import { redirect } from "next/navigation";
import { db } from "./wh-store";
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
