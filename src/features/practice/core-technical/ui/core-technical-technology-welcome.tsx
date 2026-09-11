"use client";

import type {
  CoreTechnicalTechnology,
  CoreTechnicalTechnologyOption
} from "@/features/practice/core-technical/domain/technology-focus";
import type { StoryPracticeTechnologyWelcomeExperience } from "@/features/practice/shared/ui/contracts";
import { StoryPracticeTechnologyWelcome } from "@/features/practice/shared/ui/story-practice-technology-welcome";

export function CoreTechnicalTechnologyWelcome({
  technologies
}: {
  technologies: CoreTechnicalTechnologyOption[];
}) {
  const experience: StoryPracticeTechnologyWelcomeExperience<CoreTechnicalTechnology> = {
    slug: "core-technical",
    label: "Core Technical",
    apiBase: "/api/practice/core-technical",
    routeBase: "/practice/core-technical",
    heading: "What do you want to get better at?",
    choosingScript:
      "Welcome to Core Technical practice. What technology would you like to get better at?",
    confirmingScript: (selectedLabel) =>
      `Great${selectedLabel ? `—let’s work on ${selectedLabel}` : " choice"}. I’ll pull together a focused interview practice path.`,
    generatingScript:
      "I’m preparing a focused set of practical questions and learning guides for your level.",
    options: technologies,
    buildConfirmation: (technology) => ({ technology }),
    buildPreparation: (focusRevisionId, requestId) => ({
      requestId,
      focusRevisionId,
      personalized: true
    })
  };

  return <StoryPracticeTechnologyWelcome experience={experience} />;
}
