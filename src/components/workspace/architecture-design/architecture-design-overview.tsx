"use client";

import { StoryPracticeOverview } from "@/components/workspace/story-practice/story-practice-overview";
import type { ArchitectureDesignHistoryNavigation } from "@/lib/practice/architecture-design/ui-state";
import type { ArchitectureDesignScenarioLibraryEntry } from "@/server/architecture-design/eligibility.service";
import type { ArchitectureDesignHistoryList } from "@/server/architecture-design/history.service";
import type { ArchitectureDesignPublicBlock } from "@/server/architecture-design/practice.service";
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
