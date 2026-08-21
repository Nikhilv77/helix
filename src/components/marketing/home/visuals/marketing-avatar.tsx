"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useInView } from "./reveal";

// Three.js plus a multi-megabyte model has no business in the landing page's
// initial bundle. Loaded on demand, and only once it is actually scrolled to.
const AvatarStage = dynamic(
  () => import("@/components/interview/avatar-stage").then((m) => m.AvatarStage),
  { ssr: false }
);

const AVATAR_URL = process.env.NEXT_PUBLIC_AVATAR_URL || "/avatars/interviewer-v2.glb";

export function MarketingAvatar({
  className,
  priority = false,
  framing = "default",
  active = true
}: {
  className?: string;
  priority?: boolean;
  framing?: "default" | "marketing";
  /** False parks the render loop without unmounting — see AvatarStage. */
  active?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, "200px 0px 200px 0px");

  return (
    <div ref={ref} className={className}>
      {priority || visible ? (
        <AvatarStage
          agentTrack={null}
          state="listening"
          url={AVATAR_URL}
          framing={framing}
          active={active}
          performanceProfile={framing === "marketing" ? "marketing" : "default"}
        />
      ) : null}
    </div>
  );
}

