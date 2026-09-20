"use client";

import { CoreTechnicalBlockAssessmentClient } from "@/features/practice/core-technical/ui/core-technical-block-assessment-client";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

/**
 * Architecture uses the same non-live assessment shell as DSA/Core: durable
 * request/response turns, the configured teacher, and browser TTS.
 */
export function ArchitectureDesignBlockAssessmentClient({
  sessionId,
  workspaceAccent
}: {
  sessionId: string;
  workspaceAccent: WorkspaceAccent;
}) {
  return (
    <CoreTechnicalBlockAssessmentClient
      sessionId={sessionId}
      workspaceAccent={workspaceAccent}
      assessmentKind="architecture-design"
    />
  );
}
