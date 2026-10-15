// Every page needs a sign-in, and a limited user can only open the pages they were given (the cookie carries them).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { allowed } from "@/lib/access";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const headers = new Headers(req.headers);
  headers.set("x-pathname", path);
  if (path === "/login") return NextResponse.next({ request: { headers } });
  const me = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const url = req.nextUrl.clone();
  if (!me) { url.pathname = "/login"; url.search = ""; return NextResponse.redirect(url); }
  if (!allowed(me, path)) { url.pathname = "/"; url.search = "?denied=1"; return NextResponse.redirect(url); }
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png).*)"] };
