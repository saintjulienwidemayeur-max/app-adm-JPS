// Optional password for the whole app. Set APP_PASSWORD (on Render: Environment) to turn it on; leave it empty to keep the app open.
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth-token";

export async function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw || req.nextUrl.pathname === "/login") return NextResponse.next();
  if (req.cookies.get(AUTH_COOKIE)?.value === (await authToken(pw))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png).*)"] };
