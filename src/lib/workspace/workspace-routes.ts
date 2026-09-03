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
