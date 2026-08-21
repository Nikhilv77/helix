import { Suspense } from "react";
import { VoiceInterviewClient } from "./voice-interview-client";

/** Route entry point. LiveKit and browser media stay inside the client feature. */
export default function VoiceInterviewPage() {
  return (
    <Suspense fallback={null}>
      <VoiceInterviewClient />
    </Suspense>
  );
}
