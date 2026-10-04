"use server";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authToken } from "./auth-token";

// Only paths inside this app: never an address on another site.
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/warehouse/receiving");
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export async function login(f: FormData) {
  const pw = process.env.APP_PASSWORD, next = safeNext(String(f.get("next") ?? ""));
  if (!pw) redirect(next);
  await new Promise((r) => setTimeout(r, 800)); // slows down password guessing
  if (!same(String(f.get("password") ?? ""), pw)) redirect(`/login?err=1&next=${encodeURIComponent(next)}`);
  (await cookies()).set(AUTH_COOKIE, await authToken(pw), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
