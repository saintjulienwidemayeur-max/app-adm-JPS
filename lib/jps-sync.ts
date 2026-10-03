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
  return (cli = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null);
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
