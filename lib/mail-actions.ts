"use server";
import { redirect } from "next/navigation";
import { db, cargoOf, nowStr, timeNow, type Customer } from "./wh-store";
import { ensureLoaded, flush } from "./persist";
import { requireUser, requireAdmin } from "./users";
import { allowed } from "./access";
import { act } from "./act";
import { logAudit } from "./audit";
import { mailEnabled, mailMany, siteClients, findClientId } from "./jps-sync";
import { usableEmail, isBlockedEmail, validEmail, emailProblem, PROBLEM_TEXT } from "./mailrules";

const PAGE = "/settings/email";
const go = (q: Record<string, string>): never => redirect(`${PAGE}?${new URLSearchParams(q)}`);

// The website client behind a customer: the account the customer created, else found by the customer's real e-mail.
async function clientIdOf(c: Customer): Promise<string | undefined> {
  if (c.clientId) return c.clientId;
  const mail = usableEmail(c);
  if (!mail) return undefined;
  const r = await findClientId(mail);
  if (r.id) c.clientId = r.id;
  return r.id;
}

export async function sendEmail(f: FormData) {
  await ensureLoaded();
  const me = await requireUser();
  if (!allowed(me, PAGE)) redirect("/?denied=1");
  let target = "";
  const run = async () => {
    const subject = String(f.get("subject") ?? "").trim(), message = String(f.get("message") ?? "").trim(), mode = String(f.get("mode") ?? "");
    const fail = (err: string) => { logAudit(me.name, "send email", `${mode} · ${subject}`, `refused: ${err}`); target = `${PAGE}?${new URLSearchParams({ err })}`; };
    const log = (to: string, sent: number, total: number, failed: string[]) => {
      db.maillog.unshift({ id: db.n.mail++, date: nowStr(), time: timeNow(), by: me.name, subject, to, sent, total, failed: failed.slice(0, 20) });
      db.maillog.length = Math.min(db.maillog.length, 200);
      logAudit(me.name, "send email", `${to} · ${subject}`, `sent ${sent} of ${total}${failed.length ? `, ${failed.length} not sent` : ""}`);
    };
    const done = (sent: number, total: number, failed: string[]) => { target = `${PAGE}?${new URLSearchParams({ ok: `Sent to ${sent} of ${total}.`, ...(failed.length && { fail: failed.slice(0, 5).join("; ") + (failed.length > 5 ? ` and ${failed.length - 5} more` : "") }) })}`; };
    if (!mailEnabled()) return fail("E-mail is not set up: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_STAFF_EMAIL and SITE_STAFF_PASSWORD are needed.");
    if (!subject || !message) return fail("Write the subject and the message.");
    if (subject.length > 150 || message.length > 5000) return fail("The subject (150 characters) or the message (5000) is too long.");

    if (mode === "all") {
      // Every website account, except the addresses nobody should be writing to.
      const r = await siteClients();
      if (r.error && !r.rows.length) return fail(`Could not read the website accounts: ${r.error}`);
      const ok = r.rows.filter((c) => c.email && validEmail(c.email) && !isBlockedEmail(c.email));
      const skipped = r.rows.length - ok.length;
      const m = await mailMany(ok.map((c) => c.id), subject, message);
      if (m.error && !m.sent) return fail(m.error);
      log("All customers", m.sent, ok.length, skipped ? [`${skipped} accounts skipped (shared, company or invalid address)`] : []);
      return done(m.sent, ok.length, skipped ? [`${skipped} skipped: shared, company or invalid address`] : []);
    }

    let list: Customer[] = [], label = "";
    if (mode === "shipment") {
      const name = String(f.get("shipment") ?? "");
      if (!db.shipments.some((s) => s.name === name)) return fail("Choose a shipment.");
      const nos = new Set(cargoOf(name).rows.map((x) => x.w.cust));
      list = db.customers.filter((c) => nos.has(c.no));
      label = `Shipment ${name}`;
    } else if (mode === "selected") {
      const nos = new Set(f.getAll("to").map(Number));
      list = db.customers.filter((c) => nos.has(c.no));
      label = list.length === 1 ? list[0].name : `${list.length} chosen customers`;
    } else return fail("Choose who receives the e-mail.");
    if (!list.length) return fail(mode === "shipment" ? "Nobody has pieces loaded on that shipment." : "Choose at least one customer.");
    if (list.length > 500) return fail("Choose at most 500 customers at a time.");

    // Customers without a real e-mail are not written to; they are listed so they can be fixed.
    const failed: string[] = [], ids: string[] = [];
    for (const c of list) {
      const p = emailProblem(c);
      if (p) { failed.push(`${c.name} (${PROBLEM_TEXT[p]}: waiting for a real e-mail)`); continue; }
      const id = await clientIdOf(c);
      if (id) ids.push(id); else failed.push(`${c.name} (no account on the website)`);
    }
    const m = ids.length ? await mailMany([...new Set(ids)], subject, message) : { sent: 0, total: 0, error: undefined as string | undefined };
    if (m.error) failed.push(m.error);
    log(label, m.sent, list.length, failed);
    done(m.sent, list.length, failed);
  };
  try { await run(); } finally { await flush(); }
  redirect(target || PAGE);
}

// The addresses nobody is written to (one per line). Administrators only.
export const saveBlockedEmails = act("saveBlockedEmails", async (f: FormData) => {
  await requireAdmin();
  const lines = String(f.get("list") ?? "").split(/[\n,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const bad = lines.filter((x) => !validEmail(x));
  if (bad.length) go({ err: `Not an e-mail address: ${bad.slice(0, 3).join(", ")}` });
  db.blockedEmails = [...new Set(lines)];
  go({ ok: `${db.blockedEmails.length} address${db.blockedEmails.length === 1 ? "" : "es"} are not written to.` });
});
