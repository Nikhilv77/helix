export function isWorkspaceChromeRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/practice" ||
    pathname.startsWith("/practice/") ||
    pathname === "/dsa-questions" ||
    pathname.startsWith("/dsa-questions/") ||
    pathname === "/interviews" ||
    pathname === "/resume-roast" ||
    pathname === "/progress" ||
    pathname === "/reports" ||
    pathname === "/trailmate" ||
    pathname.startsWith("/trailmate/") ||
    pathname === "/profile" ||
    pathname === "/manage"
  );
}

/**
 * Full-screen interview rooms intentionally hide the persistent navigation,
 * but they still belong to the signed-in workspace. Keeping their canvas here
 * avoids exposing the public dark document background during a route change.
 */
export function isWorkspaceCanvasRoute(pathname: string): boolean {
  return (
    isWorkspaceChromeRoute(pathname) ||
    pathname === "/interview" ||
    pathname.startsWith("/interview/")
  );
}
