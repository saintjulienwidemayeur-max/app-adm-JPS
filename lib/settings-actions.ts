"use server";
import { redirect } from "next/navigation";
import { db, DESTINATIONS } from "./wh-store";
import { act } from "./act";
import { requireAdmin } from "./users";
import { applyStorageFees } from "./storage-fees";
import { WA_EVENTS, waNumber, waSendNow, waConfigured } from "./whatsapp";

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

// ---------- WhatsApp (Administration > WhatsApp) ----------
const WAP = "/settings/whatsapp";
export const saveWhatsApp = act("saveWhatsApp", async (f: FormData) => {
  await requireAdmin();
  const cc = String(f.get("cc") ?? "").replace(/\D/g, "") || "509";
  if (cc.length > 4) redirect(`${WAP}?err=${encodeURIComponent("The country code is 1 to 4 digits (Haiti 509, USA 1).")}`);
  db.settings.wa = { on: f.get("on") === "on", cc, events: Object.fromEntries(WA_EVENTS.map((e) => [e.key, f.get(`ev_${e.key}`) === "on"])) as never };
  redirect(`${WAP}?ok=${encodeURIComponent(db.settings.wa.on ? "Saved: WhatsApp messages are ON." : "Saved: WhatsApp messages are OFF.")}`);
});
// Sends one real message to a number, and shows what WaAPI answered (to check the token and the instance).
export const testWhatsApp = act("testWhatsApp", async (f: FormData) => {
  await requireAdmin();
  const n = waNumber(String(f.get("number") ?? ""), db.settings.wa?.cc || "509"), msg = String(f.get("message") ?? "").trim().slice(0, 500) || "Test message from JP's Logistics.";
  if (!waConfigured()) redirect(`${WAP}?err=${encodeURIComponent("WAAPI_TOKEN is not set on the server (Render > Environment).")}`);
  if (!n) redirect(`${WAP}?err=${encodeURIComponent("That is not a valid number: type it with the country code, for example +509 3700 1122 or +1 305 555 0142.")}`);
  const r = await waSendNow(n, msg);
  redirect(r.error ? `${WAP}?err=${encodeURIComponent(`Not sent to ${n}: ${r.error}`)}&raw=${encodeURIComponent(r.raw)}` : `${WAP}?ok=${encodeURIComponent(`Sent to ${n}. Check the phone.`)}&raw=${encodeURIComponent(r.raw)}`);
});
// A customer can be switched off (no WhatsApp message from the system), on the customer's page.
export const setWhatsAppOff = act("setWhatsAppOff", async (no: number, off: boolean) => {
  const c = db.customers.find((x) => x.no === no);
  if (!c) return;
  c.waOff = off || undefined;
  redirect(`/warehouse/customers/${no}?ok=${encodeURIComponent(off ? "WhatsApp messages are off for this customer." : "WhatsApp messages are on for this customer.")}`);
});
