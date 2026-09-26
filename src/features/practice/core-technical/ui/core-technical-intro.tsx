"use client";

import { TEACHER_VOICE_LINES } from "@/features/practice/shared/domain/teacher-voice-lines";
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
  script: TEACHER_VOICE_LINES.coreTechnicalIntro
};

export function CoreTechnicalIntro({
  experience = CORE_TECHNICAL_INTRO_EXPERIENCE,
  ...props
}: Omit<StoryPracticeIntroProps, "experience"> & {
  experience?: StoryPracticeIntroExperience;
}) {
  return <StoryPracticeIntro {...props} experience={experience} />;
}
