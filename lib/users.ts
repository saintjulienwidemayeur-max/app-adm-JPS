// People who sign in to the app: codes (hashed), the first administrator, sign-in and the "who is this" check. Server only.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, nowStr, timeNow, type User } from "./wh-store";
import { SESSION_COOKIE, SESSION_HOURS, readSession, signSession } from "./session";
import { type Claims } from "./access";

export const MIN_CODE = 4;
const hashCode = (code: string, salt: string) => scryptSync(code, salt, 32).toString("hex");
export const newCredential = (code: string) => { const salt = randomBytes(16).toString("hex"); return { salt, hash: hashCode(code, salt) }; };
const same = (a: string, b: string) => { const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex"); return x.length === y.length && timingSafeEqual(x, y); };
export const codeMatches = (u: User, code: string) => same(u.hash, hashCode(code, u.salt));

// The first administrator, created when there is none: name jpsadmin1, code 4888 (ADMIN_NAME / ADMIN_CODE can change them).
// It is flagged as "default code" until the administrator changes it.
export function ensureAdmin(): boolean {
  if (db.users.length) return false;
  const code = process.env.ADMIN_CODE || "4888";
  db.users.push({ id: `U-${db.n.user++}`, name: process.env.ADMIN_NAME || "jpsadmin1", ...newCredential(code), admin: true, perms: [], active: true, created: nowStr(), defaultCode: !process.env.ADMIN_CODE });
  return true;
}

// Changes when the person's code, role, access or status change: a cookie made before that stops being valid.
export const versionOf = (u: User) => createHash("sha256").update([u.hash, u.admin, u.active, [...u.perms].sort().join(",")].join("|")).digest("hex").slice(0, 16);
export const claimsOf = (u: User): Claims => ({ uid: u.id, name: u.name, admin: u.admin, perms: u.admin ? [] : u.perms, ver: versionOf(u), exp: Date.now() + SESSION_HOURS * 3600_000 });
export async function startSession(u: User) {
  (await cookies()).set(SESSION_COOKIE, await signSession(claimsOf(u)), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_HOURS * 3600 });
}

// 5 wrong codes for a name lock that name for 10 minutes (a code can be as short as 4 digits).
const fails = new Map<string, { n: number; until: number }>();
export function lockedFor(name: string): number {
  const f = fails.get(name.toLowerCase());
  return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 60000) : 0;
}
export function checkLogin(name: string, code: string): User | null {
  const key = name.trim().toLowerCase();
  const u = db.users.find((x) => x.name.toLowerCase() === key && x.active);
  if (u && codeMatches(u, code)) { fails.delete(key); u.lastLogin = `${nowStr()} ${timeNow()}`; return u; }
  const f = fails.get(key) ?? { n: 0, until: 0 };
  f.n++;
  if (f.n >= 5) { f.n = 0; f.until = Date.now() + 10 * 60_000; }
  fails.set(key, f);
  return null;
}

// The signed-in user, checked against the database (so a removed or changed person is out at once). Null when nobody is.
export async function currentUser(): Promise<User | null> {
  const c = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const u = c && db.users.find((x) => x.id === c.uid);
  return u && u.active && versionOf(u) === c.ver ? u : null;
}
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u!;
}
export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!u.admin) redirect("/?denied=1");
  return u;
}
