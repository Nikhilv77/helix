"use client";

import { TEACHER_VOICE_LINES } from "@/features/practice/shared/domain/teacher-voice-lines";
import type {
  AppliedEngineeringTechnology,
  AppliedEngineeringTechnologyOption
} from "@/features/practice/applied-engineering/domain/technology-focus";
import type { StoryPracticeTechnologyWelcomeExperience } from "@/features/practice/shared/ui/contracts";
import { StoryPracticeTechnologyWelcome } from "@/features/practice/shared/ui/story-practice-technology-welcome";

export function AppliedEngineeringTechnologyWelcome({
  technologies
}: {
  technologies: AppliedEngineeringTechnologyOption[];
}) {
  // With a single reviewed stack there is nothing to choose, so the path starts
  // at once like Core Technical and Architecture. The picker returns when a
  // second stack has reviewed incidents.
  const autoStart = technologies.length === 1;
  const experience: StoryPracticeTechnologyWelcomeExperience<AppliedEngineeringTechnology> = {
    slug: "applied-engineering",
    label: "Applied Engineering",
    apiBase: "/api/practice/applied-engineering",
    routeBase: "/practice/applied-engineering",
    heading: "What do you want to get better at?",
    choosingScript: TEACHER_VOICE_LINES.appliedEngineeringWelcome,
    // The chosen technology is shown on screen; the spoken line stays fixed.
    // Starting on its own there was no choice, so skip straight to preparing.
    confirmingScript: () =>
      autoStart
        ? TEACHER_VOICE_LINES.appliedEngineeringPreparing
        : TEACHER_VOICE_LINES.appliedEngineeringConfirming,
    generatingScript: TEACHER_VOICE_LINES.appliedEngineeringPreparing,
    options: technologies,
    autoStart,
    buildConfirmation: (language) => ({ language }),
    buildPreparation: (focusRevisionId, requestId) => ({ requestId, focusRevisionId })
  };

  return <StoryPracticeTechnologyWelcome experience={experience} />;
}
