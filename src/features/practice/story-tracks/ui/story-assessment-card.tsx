"use client";

import { useRouter } from "next/navigation";
import type { PersistedAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";
import { CoreTechnicalBlockAssessmentPreview } from "@/features/practice/core-technical/ui/core-technical-block-assessment-preview";
import { AssessmentResultsScorecard } from "@/features/practice/shared/ui/assessment-results-scorecard";
import type { StoryPracticeBlockView } from "@/features/practice/shared/ui/view-contracts";
import type { StoryAssessmentSummary } from "@/features/practice/story-tracks/server/story-assessment.service";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { useTheme } from "@/lib/theme/theme-context";
import { workspaceMutationFetch } from "@/lib/workspace/summary-cache-invalidation";

const STORY_ASSESSMENT_METRICS = [
  ["revisit", "Hardest question again"],
  ["follow-ups", "Interviewer follow-ups"],
  ["trap", "Spot the trap"]
] as const;

/**
 * The selected path's written assessment, drawn with the same card the Node.js
 * tracks use so every domain's assessment looks and behaves alike.
 */
export function StoryAssessmentCard({
  summary,
  block,
  label,
  track,
  routeBase
}: {
  summary: StoryAssessmentSummary;
  block: StoryPracticeBlockView;
  label: string;
  track: PersistedAiMlPracticeTrack;
  routeBase: string;
}) {
  const router = useRouter();
  const assessmentId = "assessmentId" in summary ? summary.assessmentId : null;
  const roomHref = (id: string) => `${routeBase}/assessment?session=${encodeURIComponent(id)}`;
  const terminalCount =
    summary.status === "LOCKED"
      ? summary.total - summary.remaining
      : block.questions.filter((question) => question.status !== "ACTIVE").length;

  // Always goes through start, which resumes the same room once it exists.
  const open = async () => {
    router.push(roomHref(await startAssessment(track, block.id)));
  };

  return (
    <div>
      <CoreTechnicalBlockAssessmentPreview
        block={{
          ...block,
          // The card only reads the status and id; results come from `summary`.
          isCurrent: true,
          assessment: {
            id: assessmentId ?? block.id,
            status: summary.status === "FINALIZING" ? "IN_PROGRESS" : summary.status,
            assessment: null,
            report: null,
            transcript: null
          }
        }}
        terminalCount={terminalCount}
        allowEarlyStart={summary.status === "LOCKED" && summary.allowEarlyStart}
        label={`${label} assessment`}
        readyDescription="Four written questions from this path: your hardest question again, two interviewer follow-ups, and a common trap. About 15 minutes, graded when you submit."
        metrics={STORY_ASSESSMENT_METRICS}
        onOpen={open}
        completedContent={
          summary.status === "COMPLETED" ? (
            <StoryAssessmentResults summary={summary} title={`${block.story.title} results`} />
          ) : null
        }
      />
    </div>
  );
}

function StoryAssessmentResults({
  summary,
  title
}: {
  summary: Extract<StoryAssessmentSummary, { status: "COMPLETED" }>;
  title: string;
}) {
  const teacher = useWorkspaceTeacher();
  const { resolvedTheme } = useTheme();
  const portrait =
    resolvedTheme === "light"
      ? `/images/teacher-portraits/assessment-headsets/light/${teacher.id}.jpg`
      : `/images/teacher-portraits/assessment-headsets/${teacher.id}.jpg`;
  const { report } = summary;
  const strongest = [...report.prompts].sort((left, right) => right.score - left.score)[0];
  const weakest = [...report.prompts].sort((left, right) => left.score - right.score)[0];
  const followUpNumber = new Map<string, number>();

  return (
    <AssessmentResultsScorecard
      teacherName={teacher.name}
      teacherPortrait={portrait}
      title={title}
      overallScore={report.overallScore}
      summary={
        strongest && weakest && strongest.promptId !== weakest.promptId
          ? `Strongest on ${strongest.label.toLowerCase()} (${strongest.score}); strengthen ${weakest.label.toLowerCase()} (${weakest.score}) next.`
          : `You scored ${report.overallScore} across ${report.prompts.length} written questions.`
      }
      metrics={report.prompts.map((prompt) => {
        if (prompt.label !== "Follow-up") return { label: prompt.label, value: prompt.score };
        const number = followUpNumber.size + 1;
        followUpNumber.set(prompt.promptId, number);
        return { label: `Follow-up ${number}`, value: prompt.score };
      })}
      evidenceLines={[
        `${report.prompts.length} written questions graded against this path's answers`
      ]}
      strengths={report.prompts.map((prompt) => prompt.didWell).slice(0, 3)}
      improvementAreas={report.prompts
        .filter((prompt) => prompt.score < 80)
        .map((prompt) => prompt.missingOrIncorrect)
        .slice(0, 3)}
      questionFeedback={report.prompts.map((prompt) => ({
        title: prompt.label,
        score: prompt.score,
        feedback: prompt.result
      }))}
    />
  );
}

async function startAssessment(
  track: PersistedAiMlPracticeTrack,
  pathKey: string
): Promise<string> {
  const response = await workspaceMutationFetch("/api/practice/ai-ml/assessment/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ track, pathKey })
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: { sessionId?: string };
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.data?.sessionId) {
    throw new Error(payload?.error?.message ?? "The assessment could not be started.");
  }
  return payload.data.sessionId;
}
