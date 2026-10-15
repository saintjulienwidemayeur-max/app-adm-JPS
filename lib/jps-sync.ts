// Connects the warehouse app to the customer tracking website's Supabase project.
// The website already pushes web notifications + e-mails when `shipments.status` changes
// (database webhook -> send-notifications), so this file only has to write the status.
// Runs on the server only: SUPABASE_SERVICE_ROLE_KEY must never reach the browser.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Website statuses: 0 received in Miami · 1 in transit / customs · 2 arrived in Haiti · 3 ready for pickup
export type Status = 0 | 1 | 2 | 3;

let cli: SupabaseClient | null | undefined;
const client = () => {
  if (cli !== undefined) return cli;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try { return (cli = url && key ? createClient(url.trim(), key.trim(), { auth: { persistSession: false } }) : null); }
  catch (e) { console.error("[sync] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not valid:", e instanceof Error ? e.message : e); return (cli = null); }
};
export const syncEnabled = () => !!client();

// Finds the website client from a box number (JPS-1234), an e-mail, or an exact name.
export async function findClientId(who: string): Promise<{ id?: string; name?: string; email?: string; error?: string }> {
  const c = client();
  if (!c) return {};
  const q = who.trim();
  const tries: [string, string][] = [["box_number", q.toUpperCase()], ["email", q.toLowerCase()], ["name", q]];
  for (const [col, val] of tries) {
    const r = col === "name"
      ? await c.from("clients").select("id,name,email").ilike("name", val.replace(/[\\%_]/g, "\\$&")).limit(2)
      : await c.from("clients").select("id,name,email").eq(col, val).limit(2);
    if (r.error) return { error: r.error.message };
    if (r.data.length === 1) return { id: r.data[0].id, name: r.data[0].name, email: r.data[0].email };
    if (r.data.length > 1) return { error: `Several clients match "${q}". Use the box number (JPS-1234).` };
  }
  return { error: `No website client matches "${q}".` };
}

// Creates the shipment (status 0) or moves it forward. Never moves a parcel backwards.
// Returns an error message, or null when it worked.
export async function pushStatus(a: { tracking: string; status: Status; clientId?: string; type?: "Air" | "Ocean"; description?: string }): Promise<string | null> {
  const c = client();
  if (!c) return null;
  const ex = await c.from("shipments").select("id,status").eq("tracking_number", a.tracking).maybeSingle();
  if (ex.error) return ex.error.message;
  if (ex.data) {
    if (ex.data.status >= a.status) return null;
    const u = await c.from("shipments").update({ status: a.status, updated_at: new Date().toISOString() }).eq("id", ex.data.id);
    return u.error?.message ?? null;
  }
  if (!a.clientId) return "no client linked";
  const i = await c.from("shipments").insert({ client_id: a.clientId, tracking_number: a.tracking, type: a.type === "Ocean" ? "Mer" : "Air", description: a.description ?? null, status: a.status });
  return i.error?.message ?? null;
}

// ---------- Pre-alerts announced by customers on the website ----------
// The customer fills the pre-alert form on the website (table `prealerts`, SQL section 13 of the website's schema).
// The warehouse app only reads them (service role) and marks them received.
export type SitePrealert = {
  id: string; client_id: string; carrier: string; tracking_number: string; store: string; contents: string; declared_value: number;
  ship_choice: "Air" | "Ocean" | null; wait: boolean; restricted: boolean; created_at: string;
  clients: { name: string; email: string; phone: string | null } | null;
};
const COLS = "id,client_id,carrier,tracking_number,store,contents,declared_value,ship_choice,wait,restricted,created_at,clients(name,email,phone)";
// All expected pre-alerts, or the one with this tracking number.
export async function sitePrealerts(tracking?: string): Promise<{ rows: SitePrealert[]; error?: string }> {
  const c = client();
  if (!c) return { rows: [] };
  let q = c.from("prealerts").select(COLS).eq("status", "expected").order("created_at", { ascending: true }).limit(500);
  if (tracking) q = q.eq("tracking_number", tracking);
  const r = await q;
  if (r.error) return { rows: [], error: r.error.message };
  return { rows: (r.data ?? []) as unknown as SitePrealert[] };
}
export async function markSitePrealertReceived(id: string): Promise<string | null> {
  const c = client();
  if (!c) return null;
  const r = await c.from("prealerts").update({ status: "received", updated_at: new Date().toISOString() }).eq("id", id);
  return r.error?.message ?? null;
}

// ---------- Customers who created an account on the website ----------
export type SiteClient = { id: string; name: string; email: string; phone: string | null; address: string | null; city: string | null; country: string | null; box_number: string | null; lang: string | null; created_at: string };
// All website accounts (read page by page: Supabase returns at most 1000 rows per request).
export async function siteClients(): Promise<{ rows: SiteClient[]; error?: string }> {
  const c = client();
  if (!c) return { rows: [] };
  const rows: SiteClient[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    let r = await c.from("clients").select("id,name,email,phone,address,city,country,box_number,lang,created_at").order("created_at", { ascending: true }).range(from, from + 999);
    if (r.error) r = await c.from("clients").select("id,name,email,phone,address,city,country,box_number,created_at").order("created_at", { ascending: true }).range(from, from + 999) as typeof r; // `lang` not created yet
    if (r.error) return { rows, error: r.error.message };
    rows.push(...((r.data ?? []) as unknown as SiteClient[]));
    if ((r.data ?? []).length < 1000) break;
  }
  return { rows };
}

// ---------- E-mail through the website ----------
// The website already sends e-mail (Edge Function `admin-mail`, through Brevo). The warehouse app calls it with the website staff account
// (SITE_STAFF_EMAIL / SITE_STAFF_PASSWORD: an owner or agent of the website's admin panel), so every e-mail goes out from the website.
const ANON = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bHduaG1ib3F1bmZscXp2bGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzc4NDMsImV4cCI6MjEwNTkxMzg0M30.tAffoPTs9CFT0KR_e6_uPPfjLjNM3Re4Kev2rcePIGk";
export const mailEnabled = () => syncEnabled() && !!process.env.SITE_STAFF_EMAIL && !!process.env.SITE_STAFF_PASSWORD;
const MAIL_ERRORS: Record<string, string> = {
  NOT_AUTHORIZED: "The website refused the staff account (SITE_STAFF_EMAIL / SITE_STAFF_PASSWORD must be an owner or agent).",
  CLIENT_NOT_FOUND: "This person has no account on the website.", SEND_FAILED: "The e-mail service (Brevo) refused the message.", BAD_REQUEST: "Subject or message missing or too long.",
};
async function mailCall(body: Record<string, unknown>): Promise<{ ok?: boolean; sent?: number; total?: number; error?: string }> {
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/functions/v1/admin-mail`, {
      method: "POST", headers: { "content-type": "application/json", apikey: ANON, authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ ...body, staff_email: process.env.SITE_STAFF_EMAIL, staff_password: process.env.SITE_STAFF_PASSWORD }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; sent?: number; total?: number; error?: string };
    return r.ok ? j : { error: MAIL_ERRORS[j.error ?? ""] ?? j.error ?? `The website answered ${r.status}.` };
  } catch (e) { return { error: `Could not reach the website: ${e instanceof Error ? e.message : e}` }; }
}
export const mailOne = async (clientId: string, subject: string, message: string) => (await mailCall({ action: "send", client_id: clientId, subject, message })).error ?? null;
export const mailAll = (subject: string, message: string) => mailCall({ action: "broadcast", subject, message });
