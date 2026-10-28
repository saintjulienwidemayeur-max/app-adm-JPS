// The link a customer opens to pay a warehouse receipt (and its invoice). It carries the receipt number and a signature, so it cannot be guessed or changed:
// no sign-in is needed. Server only.
import crypto from "node:crypto";
import { db, type WR } from "./wh-store";

const secret = () => process.env.PAY_LINK_SECRET || process.env.AUTH_SECRET || "jps-dev-pay-link";
const sig = (key: string) => crypto.createHmac("sha256", secret()).update(`pay:${key}`).digest("hex").slice(0, 24);
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
// Each receipt has its own random key, kept in the shared database (`payKey`): both apps know it, so no secret has to be the same in both apps.
const keyOf = (w: { payKey?: string }) => (w.payKey ??= crypto.randomBytes(12).toString("hex"));
export const payToken = (w: { id: string; payKey?: string }) => `${Buffer.from(`wr:${w.id}`).toString("base64url")}.${keyOf(w)}`;
// The receipt a link points to (older links, signed with PAY_LINK_SECRET / made with an invoice number, still work when that secret is the same).
export function wrOfToken(token: string): WR | undefined {
  const [a, b] = decodeURIComponent(token).split(".");
  if (!a || !b) return undefined;
  let key = ""; try { key = Buffer.from(a, "base64url").toString(); } catch { return undefined; }
  if (!key) return undefined;
  const w = key.startsWith("wr:") ? db.wrs.find((x) => x.id === key.slice(3)) : db.wrs.find((x) => x.invoice === key);
  if (!w) return undefined;
  return (w.payKey && same(b, w.payKey)) || same(b, sig(key)) ? w : undefined;
}
// The public address of the BILLING app, where the PDFs and the payment API are (PAY_BASE_URL; in the billing app itself, else the address Render gives it).
// NB: the warehouse app's copy of this file reads PAY_BASE_URL only (the address Render gives the warehouse app is not the billing app). Empty when unknown: then no link is put in e-mails.
export const payBase = (fallback = "") => (process.env.PAY_BASE_URL || fallback).replace(/\/$/, "");
// The link the customer gets: the pay page of the website (https://jpslogistics.me/pay.html, same design as the site; PAY_SITE_URL can change the address).
export const siteBase = () => (process.env.PAY_SITE_URL ?? "https://jpslogistics.me").replace(/\/$/, "");
export const payUrl = (w: { id: string } | undefined, fallback = "") => (!w ? "" : siteBase() ? `${siteBase()}/pay.html?t=${payToken(w)}` : payBase(fallback) ? `${payBase(fallback)}/pay/${payToken(w)}` : "");
export const receiptUrl = (w: { id: string }, i: number, fallback = "") => (payBase(fallback) ? `${payBase(fallback)}/pay/${payToken(w)}/receipt/${i}` : "");
// The PDFs of the receipt (what was received) and of the invoice, for the customer's space.
export const docUrl = (w: { id: string }, kind: "wr" | "invoice", fallback = "") => (payBase(fallback) ? `${payBase(fallback)}/pay/${payToken(w)}/${kind}` : "");
export const OWNER_ALERT = (process.env.PAYMENT_ALERT_EMAIL || "jpslogisticsmiami@gmail.com").trim();
