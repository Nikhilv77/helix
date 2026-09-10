import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { VoiceInterviewClient } from "@/features/interviews/ui/voice/voice-interview-client";

/** Route entry point. LiveKit and browser media stay inside the client feature. */
export default async function VoiceInterviewPage({
  searchParams
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const [{ profile }, query] = await Promise.all([requireOnboardedProfile(), searchParams]);
  const sessionId = typeof query.session === "string" ? query.session.trim() : "";
  if (!sessionId) redirect("/interviews");

  return (
    <Suspense fallback={null}>
      {/* The resume backs the document preview in a resume round. It is already
          loaded here, so passing it costs nothing extra. */}
      <VoiceInterviewClient
        sessionId={sessionId}
        workspaceAccent={profile.workspaceAccent}
        resume={profile.resume}
        teacherId={profile.teacherId}
      />
    </Suspense>
  );
}
