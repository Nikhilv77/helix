"use client";

import { StoryPracticeOverview } from "@/features/practice/shared/ui/story-practice-overview";
import type { AppliedEngineeringPublicBlock } from "@/features/practice/applied-engineering/server/practice.service";
import type { AppliedEngineeringHistoryList } from "@/features/practice/applied-engineering/server/history.service";
import type { AppliedEngineeringIncidentLibraryEntry } from "@/features/practice/applied-engineering/server/eligibility.service";
import type { AppliedEngineeringHistoryNavigation } from "@/features/practice/applied-engineering/domain/ui-state";
import {
  appliedEngineeringBlockView,
  appliedEngineeringHistoryView,
  appliedEngineeringLibraryView
} from "./applied-engineering-adapter";
import { APPLIED_ENGINEERING_OVERVIEW_EXPERIENCE } from "./applied-engineering-experience";

export function AppliedEngineeringOverview({
  block,
  history,
  incidentLibrary,
  incidentHistory,
  allowEarlyAssessmentStart = false
}: {
  block: AppliedEngineeringPublicBlock;
  history: AppliedEngineeringHistoryNavigation | null;
  incidentLibrary: AppliedEngineeringIncidentLibraryEntry[];
  incidentHistory: AppliedEngineeringHistoryList;
  allowEarlyAssessmentStart?: boolean;
}) {
  return (
    <StoryPracticeOverview
      block={appliedEngineeringBlockView(block)}
      history={history ? {
        ...history,
        selected: appliedEngineeringHistoryView([history.selected])[0]!
      } : null}
      storyLibrary={appliedEngineeringLibraryView(incidentLibrary)}
      storyHistory={appliedEngineeringHistoryView(incidentHistory)}
      allowEarlyAssessmentStart={allowEarlyAssessmentStart}
      experience={APPLIED_ENGINEERING_OVERVIEW_EXPERIENCE}
    />
  );
}
