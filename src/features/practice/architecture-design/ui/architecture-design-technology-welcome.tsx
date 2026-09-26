"use client";

import { TEACHER_VOICE_LINES } from "@/features/practice/shared/domain/teacher-voice-lines";
import type { StoryPracticeTechnologyWelcomeExperience } from "@/features/practice/shared/ui/contracts";
import { StoryPracticeTechnologyWelcome } from "@/features/practice/shared/ui/story-practice-technology-welcome";

const ROLE_ALIGNED_PATH = [
  {
    value: "role-aligned",
    label: "Role-aligned system design",
    detail: "Requirements, scale, boundaries, reliability, and trade-offs"
  }
] as const;

const experience: StoryPracticeTechnologyWelcomeExperience<"role-aligned"> = {
  slug: "architecture-design",
  label: "Architecture & Design",
  apiBase: "/api/practice/architecture-design",
  routeBase: "/practice/architecture-design",
  heading: "Preparing your role-aligned system design path",
  choosingScript: TEACHER_VOICE_LINES.architectureDesignWelcome,
  confirmingScript: () => TEACHER_VOICE_LINES.architectureDesignConfirming,
  generatingScript: TEACHER_VOICE_LINES.architectureDesignPreparing,
  options: ROLE_ALIGNED_PATH,
  autoStart: true,
  buildConfirmation: () => ({ path: "role-aligned" }),
  buildPreparation: (focusRevisionId, requestId) => ({ requestId, focusRevisionId })
};

export function ArchitectureDesignTechnologyWelcome() {
  return <StoryPracticeTechnologyWelcome experience={experience} />;
}
