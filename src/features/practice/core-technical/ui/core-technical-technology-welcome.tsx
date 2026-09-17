"use client";

import type { StoryPracticeTechnologyWelcomeExperience } from "@/features/practice/shared/ui/contracts";
import { StoryPracticeTechnologyWelcome } from "@/features/practice/shared/ui/story-practice-technology-welcome";

export function CoreTechnicalTechnologyWelcome() {
  const experience: StoryPracticeTechnologyWelcomeExperience<"automatic"> = {
    slug: "core-technical",
    label: "Core Technical",
    apiBase: "/api/practice/core-technical",
    routeBase: "/practice/core-technical",
    heading: "Building your practice path from your profile",
    choosingScript:
      "I’m using your resume, target role, level, and assessment history to choose the right technical focus.",
    confirmingScript: () =>
      "I’m using your resume, target role, level, and assessment history to choose the right technical focus.",
    generatingScript:
      "I’m preparing a focused set of recurring interview questions, code evidence, and learning guides for your level.",
    options: [
      {
        value: "automatic",
        label: "Personalised technical focus",
        detail: "Derived privately from your resume, role, level, and baseline"
      }
    ],
    autoStart: true,
    buildConfirmation: () => ({ automatic: true }),
    buildPreparation: (focusRevisionId, requestId) => ({
      requestId,
      focusRevisionId,
      personalized: true
    })
  };

  return <StoryPracticeTechnologyWelcome experience={experience} />;
}
