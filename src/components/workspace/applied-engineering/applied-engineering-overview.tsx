"use client";

import { CoreTechnicalOverview } from "@/components/workspace/core-technical/core-technical-overview";
import type { AppliedEngineeringPublicBlock } from "@/server/applied-engineering/practice.service";
import type { AppliedEngineeringHistoryList } from "@/server/applied-engineering/history.service";
import type { AppliedEngineeringIncidentLibraryEntry } from "@/server/applied-engineering/eligibility.service";
import type { AppliedEngineeringHistoryNavigation } from "@/lib/practice/applied-engineering/ui-state";
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
    <CoreTechnicalOverview
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
