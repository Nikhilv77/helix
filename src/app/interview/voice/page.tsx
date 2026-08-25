import { Suspense } from "react";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { VoiceInterviewClient } from "./voice-interview-client";

/** Route entry point. LiveKit and browser media stay inside the client feature. */
export default async function VoiceInterviewPage() {
  const { profile } = await requireOnboardedProfile();

  return (
    <Suspense fallback={null}>
      {/* The resume backs the document preview in a resume round. It is already
          loaded here, so passing it costs nothing extra. */}
      <VoiceInterviewClient
        workspaceAccent={profile.workspaceAccent}
        resume={profile.resume}
        teacherId={profile.teacherId}
      />
    </Suspense>
  );
}
