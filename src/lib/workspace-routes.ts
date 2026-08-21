export function isWorkspaceChromeRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/practice" ||
    pathname.startsWith("/practice/") ||
    pathname === "/interviews" ||
    pathname === "/progress" ||
    pathname === "/reports" ||
    pathname === "/profile" ||
    pathname === "/manage" ||
    pathname.startsWith("/sessions/") ||
    pathname.startsWith("/session/")
  );
}
