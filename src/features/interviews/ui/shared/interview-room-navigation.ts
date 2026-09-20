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

export function dsaAssessmentRoomHref(sessionId: string): string {
  return `/practice/dsa/assessment?session=${encodeURIComponent(sessionId)}`;
}

export function openDsaAssessmentRoom(sessionId: string): void {
  window.location.assign(dsaAssessmentRoomHref(sessionId));
}

export function coreTechnicalAssessmentRoomHref(sessionId: string): string {
  return `/practice/core-technical/assessment?session=${encodeURIComponent(sessionId)}`;
}

export function openCoreTechnicalAssessmentRoom(sessionId: string): void {
  window.location.assign(coreTechnicalAssessmentRoomHref(sessionId));
}

export function architectureDesignAssessmentRoomHref(sessionId: string): string {
  return `/practice/architecture-design/assessment?session=${encodeURIComponent(sessionId)}`;
}

export function openArchitectureDesignAssessmentRoom(sessionId: string): void {
  window.location.assign(architectureDesignAssessmentRoomHref(sessionId));
}
