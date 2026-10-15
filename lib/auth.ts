"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./session";
import { ensureLoaded, flush } from "./persist";
import { ensureAdmin, checkLogin, lockedFor, startSession } from "./users";

// After signing in, the app always opens on the main menu (whatever page was asked for before the sign-in).
export async function login(f: FormData) {
  const name = String(f.get("name") ?? "").trim(), code = String(f.get("code") ?? "");
  await ensureLoaded();
  ensureAdmin();
  if (lockedFor(name)) redirect(`/login?err=locked&mins=${lockedFor(name)}`);
  await new Promise((r) => setTimeout(r, 800)); // slows down guessing
  const u = checkLogin(name, code);
  await flush(); // the first administrator, and the last sign-in time
  if (!u) redirect(lockedFor(name) ? `/login?err=locked&mins=${lockedFor(name)}` : "/login?err=1");
  await startSession(u!);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
