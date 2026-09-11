"use client";

import {
  StoryPracticeIntro,
  type StoryPracticeIntroExperience,
  type StoryPracticeIntroProps
} from "@/features/practice/shared/ui/story-practice-intro";

export const CORE_TECHNICAL_INTRO_EXPERIENCE: StoryPracticeIntroExperience = {
  label: "Core Technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "practice path",
  description: "Learn the practical questions that come up repeatedly in technical interviews.",
  script: (title) =>
    `I’ve prepared “${title}” around practical interview questions. Start with the concrete problem, explain what is happening, then show how you would fix it.`
};

export function CoreTechnicalIntro({
  experience = CORE_TECHNICAL_INTRO_EXPERIENCE,
  ...props
}: Omit<StoryPracticeIntroProps, "experience"> & {
  experience?: StoryPracticeIntroExperience;
}) {
  return <StoryPracticeIntro {...props} experience={experience} />;
}
