const HELP_FALLBACK = "/help";

export function safePeerHelpReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return HELP_FALLBACK;
  }
  if (value.startsWith("/help/room/")) return HELP_FALLBACK;
  return value.slice(0, 500);
}

export function peerHelpRoomHref(requestId: string, returnTo: string): string {
  const room = `/help/room/${encodeURIComponent(requestId)}`;
  return `${room}?from=${encodeURIComponent(safePeerHelpReturnTo(returnTo))}`;
}
