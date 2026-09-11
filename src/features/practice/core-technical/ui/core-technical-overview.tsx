"use client";

import {
  StoryPracticeOverview,
  type StoryPracticeOverviewExperience,
  type StoryPracticeOverviewProps
} from "@/features/practice/shared/ui/story-practice-overview";
import { CORE_TECHNICAL_ASSESSMENT_EXPERIENCE } from "./core-technical-assessment";
import { CORE_TECHNICAL_INTRO_EXPERIENCE } from "./core-technical-intro";

export type { StoryPracticeOverviewExperience };

export const CORE_TECHNICAL_OVERVIEW_EXPERIENCE: StoryPracticeOverviewExperience = {
  slug: "core-technical",
  label: "Core Technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "practice path",
  environmentLabel: "Node.js 22",
  libraryDescription: "Browse practical, reviewed interview question paths for Node.js.",
  startUnstartedPath: {
    endpoint: "/api/practice/core-technical/start-path"
  },
  coachSteps: ["Name the mechanism", "Trace cause and consequence", "Prove the repair"],
  intro: CORE_TECHNICAL_INTRO_EXPERIENCE,
  assessment: CORE_TECHNICAL_ASSESSMENT_EXPERIENCE
};

export function CoreTechnicalOverview({
  experience = CORE_TECHNICAL_OVERVIEW_EXPERIENCE,
  ...props
}: Omit<StoryPracticeOverviewProps, "experience"> & {
  experience?: StoryPracticeOverviewExperience;
}) {
  return <StoryPracticeOverview {...props} experience={experience} />;
}
