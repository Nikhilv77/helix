"use client";

import { CoreTechnicalBlockAssessmentClient } from "@/features/practice/core-technical/ui/core-technical-block-assessment-client";
import type { RecallQuizItem } from "@/features/practice/shared/domain/recall-quiz";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

/**
 * Applied Engineering uses the same typed assessment room as Core Technical and
 * Architecture: durable request/response turns, the configured teacher, and
 * short pre-recorded speech, rather than a live voice session.
 */
export function AppliedEngineeringBlockAssessmentClient({
  sessionId,
  workspaceAccent,
  recallQuiz
}: {
  sessionId: string;
  workspaceAccent: WorkspaceAccent;
  recallQuiz?: Promise<RecallQuizItem[]>;
}) {
  return (
    <CoreTechnicalBlockAssessmentClient
      sessionId={sessionId}
      workspaceAccent={workspaceAccent}
      assessmentKind="applied-engineering"
      recallQuiz={recallQuiz}
    />
  );
}
