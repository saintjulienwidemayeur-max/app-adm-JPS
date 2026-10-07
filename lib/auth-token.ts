// The login cookie holds an HMAC of a fixed text keyed with APP_PASSWORD, so the password itself is never stored.
// Web Crypto only: it runs in the middleware (edge) and in server actions (node).
export const AUTH_COOKIE = "jps_auth";
export async function authToken(password: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("jps-auth-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
