import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { getUserIdForRequest } from "@/server/auth/request-user";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getAppContainer } from "@/server/app-container";
import { serialiseInterviewState } from "@/app/api/interview/[sessionId]/route";
import { VoiceInterviewClient } from "@/features/interviews/ui/voice/voice-interview-client";
import { PreparingInterviewScreen } from "@/features/interviews/ui/voice/components/preparing-interview-screen";
import type { SessionResponse } from "@/lib/shared/types";
import { privatePageMetadata } from "@/lib/shared/seo";

// The room retitles itself as it moves through setup, live, and wrap-up; this
// is the tab title until then.
export const metadata = privatePageMetadata("Interview", "Your live Trailgrad interview room.");

/**
 * The room's first session read, done on the server alongside the profile so
 * the client does not start a second round trip after hydration. Any failure
 * returns null and the client reads it the usual way.
 */
async function readInitialSession(sessionId: string): Promise<SessionResponse | null> {
  try {
    const userId = await getUserIdForRequest();
    if (!userId) return null;
    const state = await getAppContainer().interviewService.getOwnedActive(
      authenticatedOwnerId(userId),
      sessionId
    );
    // The same JSON the session API would send, so both paths match exactly.
    return JSON.parse(JSON.stringify(serialiseInterviewState(state))) as SessionResponse;
  } catch {
    return null;
  }
}

/** Route entry point. LiveKit and browser media stay inside the client feature. */
export default async function VoiceInterviewPage({
  searchParams
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const query = await searchParams;
  const sessionId = typeof query.session === "string" ? query.session.trim() : "";
  if (!sessionId) redirect("/interviews");
  const [{ profile }, initialSession] = await Promise.all([
    requireOnboardedProfile(),
    readInitialSession(sessionId)
  ]);

  return (
    <Suspense fallback={<PreparingInterviewScreen />}>
      {/* The resume backs the document preview in a resume round. It is already
          loaded here, so passing it costs nothing extra. */}
      <VoiceInterviewClient
        key={sessionId}
        sessionId={sessionId}
        workspaceAccent={profile.workspaceAccent}
        resume={profile.resume}
        teacherId={profile.teacherId}
        initialSession={initialSession}
      />
    </Suspense>
  );
}
