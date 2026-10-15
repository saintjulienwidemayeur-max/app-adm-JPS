// The sign-in cookie: a signed (HMAC) copy of who the person is and which pages they may open.
// Web Crypto only: it runs in the middleware (edge) and in server code (node).
// The signing secret is AUTH_SECRET, or else derived from the database / Supabase settings, so nobody can forge a cookie.
import type { Claims } from "./access";

export const SESSION_COOKIE = "jps_session";
export const SESSION_HOURS = 12;

const enc = new TextEncoder();
const secret = () => {
  const s = process.env.AUTH_SECRET || process.env.DATABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.APP_PASSWORD;
  return `jps-session-v2|${s ?? "no-secret-configured"}`;
};
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function key() { return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }

export async function signSession(c: Claims): Promise<string> {
  const body = b64(enc.encode(JSON.stringify(c)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return `${body}.${b64(sig)}`;
}
export async function readSession(token: string | undefined): Promise<Claims | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await key(), unb64(sig), enc.encode(body)))) return null;
    const c = JSON.parse(new TextDecoder().decode(unb64(body))) as Claims;
    return c && typeof c.uid === "string" && Array.isArray(c.perms) && c.exp > Date.now() ? c : null;
  } catch { return null; }
}
