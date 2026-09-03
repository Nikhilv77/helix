"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

import type { AvatarPerformanceProfile } from "@/components/interview/voice/avatar-stage";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { personaById } from "@/lib/avatars/personas";

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
  transparent = false,
  performanceProfile = "default",
  personaId
}: {
  speaking?: boolean;
  transparent?: boolean;
  performanceProfile?: AvatarPerformanceProfile;
  /** Override the workspace teacher for product-owned hosts such as James. */
  personaId?: string;
}) {
  const teacher = useWorkspaceTeacher();
  const persona = personaById(personaId) ?? teacher;
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
      url={persona.model}
      rig={persona.rig}
      framing="default"
      performanceProfile={performanceProfile}
      showStatus={!transparent}
      feather={!transparent}
    />
  );
}
