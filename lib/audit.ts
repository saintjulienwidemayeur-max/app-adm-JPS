// The activity log: who did what, when, and how it ended. Passwords and codes are never written. Server only.
import { db, nowStr, timeNow } from "./wh-store";

export const AUDIT_KEEP = 5000; // the most recent entries are kept
const SECRET = /(code|password|pass|secret|token|current|next|again)/i;

export function logAudit(user: string, action: string, detail = "", result = "ok") {
  db.audit.unshift({ id: db.n.audit++, date: nowStr(), time: timeNow(), user: user.slice(0, 40), action: action.slice(0, 60), detail: detail.slice(0, 300), result: result.slice(0, 200) });
  if (db.audit.length > AUDIT_KEEP) db.audit.length = AUDIT_KEEP;
}

// A short readable summary of what an action received: the fields of a form (no secrets, no files) or its plain arguments.
export function summarize(args: unknown[]): string {
  const parts: string[] = [];
  for (const a of args) {
    if (typeof FormData !== "undefined" && a instanceof FormData) {
      const seen = new Map<string, string[]>();
      a.forEach((v, k) => {
        if (SECRET.test(k) || k.startsWith("$ACTION")) return;
        const s = v instanceof File ? `file ${v.name}` : String(v).replace(/\s+/g, " ").trim().slice(0, 50);
        if (s) seen.set(k, [...(seen.get(k) ?? []), s]);
      });
      for (const [k, v] of [...seen].slice(0, 10)) parts.push(`${k}=${v.slice(0, 4).join(",")}${v.length > 4 ? ",…" : ""}`);
    } else parts.push(String(a).slice(0, 50));
  }
  return parts.join(" · ");
}
