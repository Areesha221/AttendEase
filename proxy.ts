import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session-core";

/**
 * Optimistic route protection (Next.js 16 renamed `middleware` -> `proxy`).
 * Real authorization still happens in the data layer (requireStaff / requireEmployee).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = verifyToken(request.cookies.get(SESSION_COOKIE)?.value);

  const isEmployeeArea = pathname === "/app" || pathname.startsWith("/app/");
  const isBossArea = pathname === "/boss" || pathname.startsWith("/boss/");
  const isSharedArea = pathname === "/careers" || pathname.startsWith("/careers/");

  if (!session && (isEmployeeArea || isBossArea || isSharedArea)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session) {
    if (session.role !== "employee" && isEmployeeArea) {
      return NextResponse.redirect(new URL("/boss", request.nextUrl));
    }
    if (session.role === "employee" && isBossArea) {
      return NextResponse.redirect(new URL("/app", request.nextUrl));
    }
    if (pathname === "/login") {
      return NextResponse.redirect(new URL(session.role === "employee" ? "/app" : "/boss", request.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest|txt)$).*)"],
};
