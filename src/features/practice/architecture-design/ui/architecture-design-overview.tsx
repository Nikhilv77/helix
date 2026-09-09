"use client";

import { StoryPracticeOverview } from "@/features/practice/shared/ui/story-practice-overview";
import type { ArchitectureDesignHistoryNavigation } from "@/features/practice/architecture-design/domain/ui-state";
import type { ArchitectureDesignScenarioLibraryEntry } from "@/features/practice/architecture-design/server/eligibility.service";
import type { ArchitectureDesignHistoryList } from "@/features/practice/architecture-design/server/history.service";
import type { ArchitectureDesignPublicBlock } from "@/features/practice/architecture-design/server/practice.service";
import {
  architectureDesignBlockView,
  architectureDesignHistoryView,
  architectureDesignLibraryView
} from "./architecture-design-adapter";
import { ARCHITECTURE_DESIGN_OVERVIEW_EXPERIENCE } from "./architecture-design-experience";

export function ArchitectureDesignOverview({
  block,
  history,
  scenarioLibrary,
  scenarioHistory,
  allowEarlyAssessmentStart = false
}: {
  block: ArchitectureDesignPublicBlock;
  history: ArchitectureDesignHistoryNavigation | null;
  scenarioLibrary: ArchitectureDesignScenarioLibraryEntry[];
  scenarioHistory: ArchitectureDesignHistoryList;
  allowEarlyAssessmentStart?: boolean;
}) {
  return (
    <StoryPracticeOverview
      block={architectureDesignBlockView(block)}
      history={
        history
          ? {
              ...history,
              selected: architectureDesignHistoryView([history.selected])[0]!
            }
          : null
      }
      storyLibrary={architectureDesignLibraryView(scenarioLibrary)}
      storyHistory={architectureDesignHistoryView(scenarioHistory)}
      allowEarlyAssessmentStart={allowEarlyAssessmentStart}
      experience={ARCHITECTURE_DESIGN_OVERVIEW_EXPERIENCE}
    />
  );
}
