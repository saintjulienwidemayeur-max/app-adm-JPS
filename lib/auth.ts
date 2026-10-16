"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./session";
import { ensureLoaded, flush } from "./persist";
import { ensureAdmin, checkLogin, lockedFor, startSession, currentUser } from "./users";
import { logAudit } from "./audit";

// After signing in, the app always opens on the main menu (whatever page was asked for before the sign-in).
export async function login(f: FormData) {
  const name = String(f.get("name") ?? "").trim(), code = String(f.get("code") ?? "");
  try { await ensureLoaded(); } catch { redirect("/login?err=db"); } // the database is configured but not reachable
  ensureAdmin();
  if (lockedFor(name)) { logAudit(name || "?", "sign in", "", "refused: name locked after wrong codes"); await flush(); redirect(`/login?err=locked&mins=${lockedFor(name)}`); }
  await new Promise((r) => setTimeout(r, 800)); // slows down guessing
  const u = checkLogin(name, code);
  logAudit(u ? u.name : name || "?", "sign in", "", u ? "ok" : "refused: wrong name or code");
  await flush(); // the first administrator, the last sign-in time and the log
  if (!u) redirect(lockedFor(name) ? `/login?err=locked&mins=${lockedFor(name)}` : "/login?err=1");
  await startSession(u!);
  redirect("/");
}

export async function logout() {
  const u = await currentUser().catch(() => null);
  if (u) { logAudit(u.name, "sign out"); await flush(); }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
