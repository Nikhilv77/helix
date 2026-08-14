import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CLERK_COOKIE_NAMES = new Set(["__session", "__client", "__clerk_db_jwt"]);

function isClerkCookie(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    CLERK_COOKIE_NAMES.has(name) ||
    normalized.startsWith("__clerk") ||
    normalized.startsWith("clerk") ||
    normalized.includes("_clerk")
  );
}

export function GET(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.headers.set("Clear-Site-Data", '"cookies", "storage"');
  response.headers.set("Cache-Control", "no-store");

  for (const cookie of request.cookies.getAll()) {
    if (!isClerkCookie(cookie.name)) continue;
    response.cookies.set(cookie.name, "", {
      expires: new Date(0),
      maxAge: 0,
      path: "/"
    });
  }

  return response;
}
