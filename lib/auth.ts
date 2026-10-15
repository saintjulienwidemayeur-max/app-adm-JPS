"use server";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authToken } from "./auth-token";

// After signing in, the app always opens on the main menu (whatever page was asked for before the sign-in).
const HOME = "/";
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export async function login(f: FormData) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) redirect(HOME);
  await new Promise((r) => setTimeout(r, 800)); // slows down password guessing
  if (!same(String(f.get("password") ?? ""), pw)) redirect("/login?err=1");
  (await cookies()).set(AUTH_COOKIE, await authToken(pw), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(HOME);
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
