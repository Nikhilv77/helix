/** The live room accepts exactly one durable interview session identifier. */
export function interviewRoomHref(sessionId: string): string {
  return `/interview/voice?session=${encodeURIComponent(sessionId)}`;
}

/**
 * Enter media rooms with a document navigation. This gives the server-owned
 * session query to the route before any LiveKit/client state can mount.
 */
export function openInterviewRoom(sessionId: string): void {
  window.location.assign(interviewRoomHref(sessionId));
}
