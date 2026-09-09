"use client";

import { StoryPracticeQuestionWorkspace } from "@/features/practice/shared/ui/story-practice-question-workspace";
import type {
  ArchitectureDesignPublicBlock,
  ArchitectureDesignPublicQuestion
} from "@/features/practice/architecture-design/server/practice.service";
import {
  architectureDesignBlockView,
  architectureDesignQuestionView
} from "./architecture-design-adapter";
import { ARCHITECTURE_DESIGN_WORKSPACE_EXPERIENCE } from "./architecture-design-experience";

export function ArchitectureDesignQuestionWorkspace({
  block,
  initialQuestion,
  stageTitle
}: {
  block: ArchitectureDesignPublicBlock;
  initialQuestion: ArchitectureDesignPublicQuestion;
  stageTitle: string;
}) {
  return (
    <StoryPracticeQuestionWorkspace
      block={architectureDesignBlockView(block)}
      initialQuestion={architectureDesignQuestionView(initialQuestion)}
      stageTitle={stageTitle}
      experience={ARCHITECTURE_DESIGN_WORKSPACE_EXPERIENCE}
    />
  );
}
