"use client";

import dynamic from "next/dynamic";

import { personaById } from "@/lib/avatars/personas";

const AvatarStage = dynamic(
  () => import("@/components/interview/voice/avatar-stage").then((m) => m.AvatarStage),
  { ssr: false, loading: () => null }
);

/**
 * The chosen teacher, kept on screen for the rest of onboarding.
 *
 * Mounted once by the flow and deliberately outside the keyed step section, so
 * moving between steps does not tear down the WebGL context and re-download the
 * model. It is decorative and silent — the avatar has no audio source here, so
 * the face idles and blinks rather than speaking.
 */
export function TeacherCompanion({ teacherId }: { teacherId: string | null }) {
  const persona = personaById(teacherId);
  if (!persona) return null;

  return (
    <aside
      aria-label={`${persona.name} is guiding your setup`}
      className="pointer-events-none fixed bottom-4 right-4 z-20 hidden w-40 lg:block xl:w-48"
    >
      <div className="relative h-48 w-full overflow-hidden rounded-[1.2rem] border border-white/10 bg-[linear-gradient(145deg,#1b1c20,#16171a)] shadow-[0_24px_60px_-44px_rgba(0,0,0,0.9)] xl:h-56">
        <AvatarStage
          agentTrack={null}
          state="listening"
          url={persona.model}
          rig={persona.rig}
          // Head-and-shoulders: the Rocketbox models sit in their bind pose,
          // and wider framing puts the outstretched arms on screen.
          framing="default"
          showStatus={false}
          feather={false}
        />
        <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(14,15,17,0.94)] to-transparent px-3 pb-2.5 pt-8 text-[12px] font-semibold text-cream">
          {persona.name}
        </p>
      </div>
    </aside>
  );
}
