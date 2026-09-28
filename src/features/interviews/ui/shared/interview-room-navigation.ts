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

export function appliedEngineeringAssessmentRoomHref(sessionId: string): string {
  return `/practice/applied-engineering/assessment?session=${encodeURIComponent(sessionId)}`;
}

export function openAppliedEngineeringAssessmentRoom(sessionId: string): void {
  window.location.assign(appliedEngineeringAssessmentRoomHref(sessionId));
}

export function architectureDesignAssessmentRoomHref(sessionId: string): string {
  return `/practice/architecture-design/assessment?session=${encodeURIComponent(sessionId)}`;
}

export function openArchitectureDesignAssessmentRoom(sessionId: string): void {
  window.location.assign(architectureDesignAssessmentRoomHref(sessionId));
}

type RoomSetup = {
  storyPracticeAssessment?: { practice?: string } | null;
  dsaBlockAssessment?: { kind?: string } | null;
} | null;

/**
 * The room a session belongs in. Practice checkpoints that run in their own
 * typed room must not reopen in the live voice room, which would run them as
 * a Gemini interview with one-click answers.
 */
export function sessionRoomHref(sessionId: string, setup?: RoomSetup): string {
  const practice = setup?.storyPracticeAssessment?.practice;
  if (practice === "architecture-design") return architectureDesignAssessmentRoomHref(sessionId);
  if (practice === "applied-engineering") return appliedEngineeringAssessmentRoomHref(sessionId);
  if (practice === "core-technical") return coreTechnicalAssessmentRoomHref(sessionId);
  if (setup?.dsaBlockAssessment?.kind === "dsa-block-assessment") {
    return dsaAssessmentRoomHref(sessionId);
  }
  return interviewRoomHref(sessionId);
}
