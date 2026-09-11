"use client";

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
  const experience: StoryPracticeTechnologyWelcomeExperience<AppliedEngineeringTechnology> = {
    slug: "applied-engineering",
    label: "Applied Engineering",
    apiBase: "/api/practice/applied-engineering",
    routeBase: "/practice/applied-engineering",
    heading: "What do you want to get better at?",
    choosingScript:
      "Welcome to Applied Engineering practice. Which technology should we use for your production incidents?",
    confirmingScript: (selectedLabel) =>
      `Great${selectedLabel ? `—let’s work in ${selectedLabel}` : " choice"}. I’ll prepare a focused production engineering path.`,
    generatingScript:
      "I’m preparing a reviewed incident with practical diagnosis, repair, testing, and rollout questions.",
    options: technologies,
    buildConfirmation: (language) => ({ language }),
    buildPreparation: (focusRevisionId, requestId) => ({ requestId, focusRevisionId })
  };

  return <StoryPracticeTechnologyWelcome experience={experience} />;
}
