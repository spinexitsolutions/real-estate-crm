import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
// Reachable both signed in and signed out (no redirect either way)
const OPEN_PATHS = ["/sw.js", "/manifest.webmanifest", "/api/cron", "/api/webhooks"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!session && !isPublic) {
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (session && (isPublic || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/webhooks|api/cron|_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
