const HELP_FALLBACK = "/trailmate";

export function safePeerHelpReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return HELP_FALLBACK;
  }
  if (value.startsWith("/trailmate/room/")) return HELP_FALLBACK;
  return value.slice(0, 500);
}

export function peerHelpRoomHref(requestId: string, returnTo: string): string {
  const room = `/trailmate/room/${encodeURIComponent(requestId)}`;
  return `${room}?from=${encodeURIComponent(safePeerHelpReturnTo(returnTo))}`;
}
