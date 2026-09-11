"use client";

import {
  StoryPracticePreparation,
  type StoryPracticePreparationExperience
} from "@/features/practice/shared/ui/story-practice-preparation";

export const CORE_TECHNICAL_PREPARATION_EXPERIENCE: StoryPracticePreparationExperience = {
  slug: "core-technical",
  apiBase: "/api/practice/core-technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "practice path",
  heading: "What technology do you want to practise?",
  optionLabel: "Practice technology",
  optionIcon: "code",
  options: [
    { value: "javascript", label: "JavaScript", detail: "Practical Node.js interview questions" }
  ],
  defaultOption: "javascript",
  buildConfirmation: (technology) => ({ technology })
};

export function CoreTechnicalPreparation({
  experience = CORE_TECHNICAL_PREPARATION_EXPERIENCE
}: {
  experience?: StoryPracticePreparationExperience;
} = {}) {
  return <StoryPracticePreparation experience={experience} />;
}
