"use client";

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
  choosingScript:
    "Welcome to Architecture and Design practice. Let’s build the system-design path aligned to your role.",
  confirmingScript: () =>
    "Great—let’s work through a role-aligned system design. I’ll use your interview context to choose the best starting scenario.",
  generatingScript:
    "I’m preparing a reviewed scenario with requirements, data, architecture, reliability, and evolution questions.",
  options: ROLE_ALIGNED_PATH,
  autoStart: true,
  buildConfirmation: () => ({ path: "role-aligned" }),
  buildPreparation: (focusRevisionId, requestId) => ({ requestId, focusRevisionId })
};

export function ArchitectureDesignTechnologyWelcome() {
  return <StoryPracticeTechnologyWelcome experience={experience} />;
}
