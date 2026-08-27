"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";

/**
 * The selected teacher on workspace pages. The 3D stage is client-only and
 * heavy, so it loads after the shell paints and leaves a matching placeholder.
 */
const AvatarStage = dynamic(
  () => import("@/components/interview/voice/avatar-stage").then((module) => module.AvatarStage),
  {
    ssr: false,
    loading: () => <AvatarPlaceholder />
  }
);

const TransparentAvatarStage = dynamic(
  () => import("@/components/interview/voice/avatar-stage").then((module) => module.AvatarStage),
  {
    ssr: false,
    loading: () => null
  }
);

const subscribeToHydration = () => () => undefined;

function AvatarPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="h-10 w-10 animate-pulse rounded-full bg-cream/[0.08] shadow-[0_0_36px_rgba(239,232,214,0.12)]" />
    </div>
  );
}

export function MayaStage({
  speaking = false,
  transparent = false
}: {
  speaking?: boolean;
  transparent?: boolean;
}) {
  const teacher = useWorkspaceTeacher();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  // Do not reach Next's `ssr: false` dynamic boundary during the server pass.
  // Inside a streamed dashboard Suspense boundary that bailout is reported as
  // a server-render failure even though the client can recover successfully.
  if (!hydrated) return transparent ? null : <AvatarPlaceholder />;

  const Stage = transparent ? TransparentAvatarStage : AvatarStage;

  return (
    <Stage
      agentTrack={null}
      state={speaking ? "speaking" : "listening"}
      url={teacher.model}
      rig={teacher.rig}
      framing="default"
      showStatus={!transparent}
      feather={!transparent}
    />
  );
}
