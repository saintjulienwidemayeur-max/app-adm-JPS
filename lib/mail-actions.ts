"use server";
import { redirect } from "next/navigation";
import { db, cargoOf, nowStr, timeNow, type Customer } from "./wh-store";
import { ensureLoaded, flush } from "./persist";
import { requireUser } from "./users";
import { allowed } from "./access";
import { mailEnabled, mailOne, mailAll, findClientId } from "./jps-sync";

const PAGE = "/settings/email";
const go = (q: Record<string, string>): never => redirect(`${PAGE}?${new URLSearchParams(q)}`);

// The website client behind a customer: the account the customer created, else found by e-mail.
async function clientIdOf(c: Customer): Promise<string | undefined> {
  if (c.clientId) return c.clientId;
  if (!c.email) return undefined;
  const r = await findClientId(c.email);
  if (r.id) c.clientId = r.id;
  return r.id;
}

export async function sendEmail(f: FormData) {
  await ensureLoaded();
  const me = await requireUser();
  if (!allowed(me, PAGE)) redirect("/?denied=1");
  try {
    const subject = String(f.get("subject") ?? "").trim(), message = String(f.get("message") ?? "").trim(), mode = String(f.get("mode") ?? "");
    if (!mailEnabled()) go({ err: "E-mail is not set up: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_STAFF_EMAIL and SITE_STAFF_PASSWORD are needed." });
    if (!subject || !message) go({ err: "Write the subject and the message." });
    if (subject.length > 150 || message.length > 5000) go({ err: "The subject (150 characters) or the message (5000) is too long." });
    const log = (to: string, sent: number, total: number, failed: string[]) => {
      db.maillog.unshift({ id: db.n.mail++, date: nowStr(), time: timeNow(), by: me.name, subject, to, sent, total, failed: failed.slice(0, 20) });
      db.maillog.length = Math.min(db.maillog.length, 200);
    };

    if (mode === "all") {
      const r = await mailAll(subject, message);
      if (r.error) go({ err: r.error });
      log("All customers", r.sent ?? 0, r.total ?? 0, []);
      go({ ok: `Sent to ${r.sent} of ${r.total} customers.` });
    }

    let list: Customer[] = [], label = "";
    if (mode === "shipment") {
      const name = String(f.get("shipment") ?? "");
      if (!db.shipments.some((s) => s.name === name)) go({ err: "Choose a shipment." });
      const nos = new Set(cargoOf(name).rows.map((x) => x.w.cust));
      list = db.customers.filter((c) => nos.has(c.no));
      label = `Shipment ${name}`;
    } else if (mode === "selected") {
      const nos = new Set(f.getAll("to").map(Number));
      list = db.customers.filter((c) => nos.has(c.no));
      label = list.length === 1 ? list[0].name : `${list.length} chosen customers`;
    } else go({ err: "Choose who receives the e-mail." });
    if (!list.length) go({ err: mode === "shipment" ? "Nobody has pieces loaded on that shipment." : "Choose at least one customer." });
    if (list.length > 500) go({ err: "Choose at most 500 customers at a time." });

    let sent = 0;
    const failed: string[] = [];
    for (let i = 0; i < list.length; i += 4) {
      await Promise.all(list.slice(i, i + 4).map(async (c) => {
        const id = await clientIdOf(c);
        const err = id ? await mailOne(id, subject, message) : "no account on the website";
        if (err) failed.push(`${c.name} (${err})`); else sent++;
      }));
    }
    log(label, sent, list.length, failed);
    go({ ok: `Sent to ${sent} of ${list.length}.`, ...(failed.length && { fail: failed.slice(0, 5).join("; ") + (failed.length > 5 ? ` and ${failed.length - 5} more` : "") }) });
  } finally { await flush(); }
}
