// Pre-alerts announced by customers on the website live in the same Supabase database the warehouse app reads (table `prealerts`).
// They are copied into the warehouse's own records automatically: when the Pre-alerts page opens, and when a tracking number is scanned.
// Server only. Not a "use server" file: these functions are not callable from the browser.
import { db, findCustomer, newCustomer, effectiveShip, type Prealert } from "./wh-store";
import { cleanTrackingNo } from "./compliance";
import { usToday } from "./clock";
import { syncEnabled, sitePrealerts, markSitePrealertReceived, type SitePrealert } from "./jps-sync";

export async function adoptSitePrealert(row: SitePrealert): Promise<Prealert> {
  const tracking = cleanTrackingNo(row.tracking_number);
  const have = db.prealerts.find((x) => x.siteId === row.id || (x.status !== "Cancelled" && cleanTrackingNo(x.tracking) === tracking));
  if (have) return have;
  const who = row.clients;
  const c = (who?.email ? findCustomer(who.email) : undefined) ?? (who?.name ? findCustomer(who.name) : undefined)
    ?? newCustomer(who?.name || "Website customer", { email: who?.email ?? "", phone: who?.phone ?? "" });
  const day = usToday(new Date(row.created_at));
  const pa: Prealert = {
    id: `PA-${String(db.n.prealert++).padStart(4, "0")}`, created: day, cust: c.no, customer: c.name, carrier: row.carrier.toUpperCase(), tracking,
    vendor: row.store, items: [{ desc: row.contents, qty: 1, unit: Number(row.declared_value) }], invoiceRef: "", hazards: row.restricted ? ["restricted"] : [],
    consigneeName: c.consignee, consigneePhone: c.consigneePhone, choice: row.ship_choice ?? undefined, wait: row.wait,
    signedBy: `${who?.name ?? c.name} (website)`, signedAt: `${day} (confirmed on the website)`, notes: "", status: "Expected", siteId: row.id, clientId: row.client_id,
  };
  db.prealerts.unshift(pa);
  // The parcel may already be in the warehouse, unidentified: match it now.
  const it = db.items.find((i) => cleanTrackingNo(i.tracking) === tracking);
  if (it && !it.piece && !it.customer) { Object.assign(it, { customer: c.name, ship: effectiveShip(pa), prealert: pa.id, clientId: row.client_id }); Object.assign(pa, { status: "Received", itemId: it.id }); await markSitePrealertReceived(row.id); }
  return pa;
}

// Brings in everything customers announced and keeps the shipping choice up to date while the parcel has not arrived.
// Returns an error message when the website could not be read (the page still shows what it already has).
let last = 0;
export async function syncSitePrealerts(): Promise<string> {
  try { return await run(); } catch (e) { return e instanceof Error ? e.message : String(e); } // a website problem must never break a page
}
async function run(): Promise<string> {
  if (!syncEnabled() || Date.now() - last < 5000) return "";
  last = Date.now();
  const r = await sitePrealerts();
  if (r.error) return r.error;
  for (const row of r.rows) {
    const pa = await adoptSitePrealert(row);
    if (pa.siteId === row.id && pa.status === "Expected") {
      pa.choice = row.ship_choice ?? undefined; pa.wait = row.wait; // the customer may have answered since
      const it = db.items.find((i) => i.id === pa.itemId);
      if (it && !it.piece) it.ship = effectiveShip(pa);
    }
  }
  // Pre-alerts the customer cancelled on the website.
  const open = new Set(r.rows.map((x) => x.id));
  for (const pa of db.prealerts) if (pa.siteId && pa.status === "Expected" && !open.has(pa.siteId)) pa.status = "Cancelled";
  return "";
}
