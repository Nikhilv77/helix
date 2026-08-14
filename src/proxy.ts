import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-trailgrad-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-trailgrad-search", request.nextUrl.search);
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

/**
 * Nothing is gated at the edge: interviews run logged out by design, and the
 * API routes authorise themselves. The middleware runs only so `auth()` is
 * available to server components.
 *
 * The previous matcher still protected /projects and /design-sessions, which
 * no longer exist.
 */
const proxy = clerkEnabled
  ? clerkMiddleware((_auth, request) => nextWithPathname(request))
  : function localMarketingProxy(request: NextRequest) {
      return nextWithPathname(request);
    };

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
