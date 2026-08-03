"use client";

import dynamic from "next/dynamic";

/**
 * Maya on the home page. The 3D stage is client-only and heavy, so it loads
 * after the shell paints and leaves a matching placeholder in the meantime.
 */
const AvatarStage = dynamic(
  () => import("@/components/interview/avatar-stage").then((module) => module.AvatarStage),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-[#102764]/60" />
  }
);

export function MayaStage() {
  return <AvatarStage agentTrack={null} state="listening" url="/avatars/interviewer.glb" />;
}
