// Website accounts become customers of the warehouse app (same Supabase database): when someone creates an account on the website
// they appear on the Customers page by themselves. Matched by website id, then by e-mail. Server only, not a "use server" file.
import { db, findCustomer, newCustomer } from "./wh-store";
import { syncEnabled, siteClients, type SiteClient } from "./jps-sync";
import { flush } from "./persist";

const COUNTRY: Record<string, string> = { "Haïti": "Haiti", "États-Unis": "United States" };
let last = 0;

export async function syncSiteClients(force = false): Promise<{ added: number; error?: string }> {
  try { return await run(force); } catch (e) { return { added: 0, error: e instanceof Error ? e.message : String(e) }; } // a website problem must never break a page
}
async function run(force: boolean): Promise<{ added: number; error?: string }> {
  if (!syncEnabled() || (!force && Date.now() - last < 15000)) return { added: 0 };
  last = Date.now();
  const r = await siteClients();
  if (r.error && !r.rows.length) return { added: 0, error: r.error };
  let added = 0;
  for (const row of r.rows) {
    const email = (row.email ?? "").trim().toLowerCase();
    const mine = db.customers.find((c) => c.clientId === row.id) ?? (email ? findCustomer(email) : undefined);
    const billing = [row.address, row.city, row.country].filter(Boolean).join(", ");
    if (mine) {
      // Fill what the warehouse does not know yet; never overwrite what staff typed here.
      mine.siteJoined ??= Date.parse(row.created_at) || undefined;
      Object.assign(mine, { clientId: row.id, box: row.box_number ?? mine.box, lang: row.lang ?? mine.lang });
      if (!mine.phone && row.phone) mine.phone = row.phone;
      if (!mine.email && email) mine.email = email;
      if (!mine.billing && billing) mine.billing = billing;
    } else {
      newCustomer(row.name || email || "Website customer", { email, phone: row.phone ?? "", billing, clientId: row.id, box: row.box_number ?? undefined, lang: row.lang ?? undefined, siteJoined: Date.parse(row.created_at) || undefined, consigneeCountry: COUNTRY[row.country ?? ""] ?? "Haiti" });
      added++;
    }
  }
  return { added, error: r.error };
}
// Any page: look for new website accounts in the background (never delays the page), at most every 2 minutes, so a new sign-up reaches the Customers list
// even if nobody opens a page that syncs by itself.
let bg = 0;
export function backgroundSiteSync() {
  if (Date.now() - bg < 120_000) return; bg = Date.now();
  void syncSiteClients(true).then(async (r) => { if (r.added) await flush(); }).catch(() => {});
}
export type { SiteClient };
