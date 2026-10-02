/** Written assessment rooms for the Frontend, Data, and AI/ML story tracks. */
const STORY_TRACK_ASSESSMENT_ROUTE =
  /^\/practice\/(?:ai-ml|frontend|data)\/(?:core-technical|applied-engineering)\/assessment$/;

export function isWorkspaceChromeRoute(pathname: string): boolean {
  if (
    STORY_TRACK_ASSESSMENT_ROUTE.test(pathname) ||
    pathname === "/practice/dsa/assessment" ||
    pathname === "/practice/core-technical/assessment" ||
    pathname.startsWith("/practice/core-technical/assessment/") ||
    pathname === "/practice/applied-engineering/assessment" ||
    pathname === "/practice/architecture-design/assessment"
  ) {
    return false;
  }
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
    pathname === "/manage" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

/**
 * Full-screen interview rooms intentionally hide the persistent navigation,
 * but they still belong to the signed-in workspace. Keeping their canvas here
 * avoids exposing the public dark document background during a route change.
 */
export function isWorkspaceCanvasRoute(pathname: string): boolean {
  return (
    pathname === "/practice/dsa/assessment" ||
    pathname === "/practice/core-technical/assessment" ||
    pathname.startsWith("/practice/core-technical/assessment/") ||
    pathname === "/practice/applied-engineering/assessment" ||
    pathname === "/practice/architecture-design/assessment" ||
    STORY_TRACK_ASSESSMENT_ROUTE.test(pathname) ||
    isWorkspaceChromeRoute(pathname) ||
    pathname.startsWith("/interview/")
  );
}
