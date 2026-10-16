// Which e-mail addresses may be used to write to a customer. JP's own mailboxes and the addresses shared by many customers (the blocked list
// the administrator keeps) are not a customer's own address: nothing is e-mailed there until the customer gets a real one.
import { db, type Customer } from "./wh-store";
import { COMPANY_EMAILS } from "./company";

const FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const validEmail = (e: string) => FORMAT.test(e.trim());
export const isBlockedEmail = (e: string) => { const t = e.trim().toLowerCase(); return COMPANY_EMAILS.includes(t) || db.blockedEmails.some((x) => x.trim().toLowerCase() === t); };
export const emailsOf = (c: Pick<Customer, "email" | "emailMore">) => [c.email, ...(c.emailMore ?? "").split(/[;,\s]+/)].map((e) => e.trim().toLowerCase()).filter((e, i, a) => e && validEmail(e) && a.indexOf(e) === i);
// The address to write to, or undefined when the customer has no real one yet.
export const usableEmail = (c: Pick<Customer, "email" | "emailMore">) => emailsOf(c).find((e) => !isBlockedEmail(e));
export const emailProblem = (c: Pick<Customer, "email" | "emailMore">): "" | "missing" | "invalid" | "shared" => {
  if (usableEmail(c)) return "";
  if (!c.email.trim()) return "missing";
  return emailsOf(c).length ? "shared" : "invalid";
};
export const PROBLEM_TEXT = { missing: "no e-mail", invalid: "the e-mail is not valid", shared: "shared or company e-mail" } as const;
