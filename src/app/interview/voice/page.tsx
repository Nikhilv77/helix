import { Suspense } from "react";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { VoiceInterviewClient } from "./voice-interview-client";

/** Route entry point. LiveKit and browser media stay inside the client feature. */
export default async function VoiceInterviewPage() {
  const { profile } = await requireOnboardedProfile();

  return (
    <Suspense fallback={null}>
      <VoiceInterviewClient workspaceAccent={profile.workspaceAccent} />
    </Suspense>
  );
}
