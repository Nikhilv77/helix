"use client";

import dynamic from "next/dynamic";

/**
 * Maya on the home page. The 3D stage is client-only and heavy, so it loads
 * after the shell paints and leaves a matching placeholder in the meantime.
 */
const AvatarStage = dynamic(
  () => import("@/components/interview/voice/avatar-stage").then((module) => module.AvatarStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <span className="h-10 w-10 animate-pulse rounded-full bg-cream/[0.08] shadow-[0_0_36px_rgba(239,232,214,0.12)]" />
      </div>
    )
  }
);

export function MayaStage({ speaking = false }: { speaking?: boolean }) {
  return (
    <AvatarStage
      agentTrack={null}
      state={speaking ? "speaking" : "listening"}
      url="/avatars/interviewer-v2.glb"
    />
  );
}
