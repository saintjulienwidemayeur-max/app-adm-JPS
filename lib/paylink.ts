// The link a customer opens to pay a warehouse receipt (and its invoice). It carries the receipt number and a signature, so it cannot be guessed or changed:
// no sign-in is needed. Server only. PAY_LINK_SECRET must be the same in the billing app and the warehouse app (else AUTH_SECRET is used).
import crypto from "node:crypto";
import { db, type WR } from "./wh-store";

const secret = () => process.env.PAY_LINK_SECRET || process.env.AUTH_SECRET || "jps-dev-pay-link";
const sig = (key: string) => crypto.createHmac("sha256", secret()).update(`pay:${key}`).digest("hex").slice(0, 24);
export const payToken = (wrId: string) => `${Buffer.from(`wr:${wrId}`).toString("base64url")}.${sig(`wr:${wrId}`)}`;
// The receipt a link points to (links made with an invoice number, before receipts could be paid, still work).
export function wrOfToken(token: string): WR | undefined {
  const [a, b] = decodeURIComponent(token).split(".");
  if (!a || !b) return undefined;
  let key = ""; try { key = Buffer.from(a, "base64url").toString(); } catch { return undefined; }
  const want = sig(key);
  if (!key || b.length !== want.length || !crypto.timingSafeEqual(Buffer.from(b), Buffer.from(want))) return undefined;
  return key.startsWith("wr:") ? db.wrs.find((x) => x.id === key.slice(3)) : db.wrs.find((x) => x.invoice === key);
}
// The public address of this app (PAY_BASE_URL, else the one Render gives). Empty when unknown: then no link is put in e-mails.
export const payBase = (fallback = "") => (process.env.PAY_BASE_URL || process.env.RENDER_EXTERNAL_URL || fallback).replace(/\/$/, "");
// The link the customer gets: the pay page of the website (PAY_SITE_URL, same design as the site) when it is set, else this app's own pay page.
export const siteBase = () => (process.env.PAY_SITE_URL ?? "").replace(/\/$/, "");
export const payUrl = (w: { id: string } | undefined, fallback = "") => (!w ? "" : siteBase() ? `${siteBase()}/pay.html?t=${payToken(w.id)}` : payBase(fallback) ? `${payBase(fallback)}/pay/${payToken(w.id)}` : "");
export const receiptUrl = (w: { id: string }, i: number, fallback = "") => (payBase(fallback) ? `${payBase(fallback)}/pay/${payToken(w.id)}/receipt/${i}` : "");
// The PDFs of the receipt (what was received) and of the invoice, for the customer's space.
export const docUrl = (w: { id: string }, kind: "wr" | "invoice", fallback = "") => (payBase(fallback) ? `${payBase(fallback)}/pay/${payToken(w.id)}/${kind}` : "");
export const OWNER_ALERT = (process.env.PAYMENT_ALERT_EMAIL || "jpslogisticsmiami@gmail.com").trim();
