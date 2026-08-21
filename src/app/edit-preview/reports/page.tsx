import { notFound } from "next/navigation";
import { ReportsView } from "@/components/workspace/reports/reports-view";
import { WorkspaceShell } from "@/components/workspace/chrome/workspace-shell";
import { privatePageMetadata } from "@/lib/shared/seo";
import { createReportsOverview } from "@/server/interview/reports-overview";
import type { InterviewCompetencyReport, InterviewReport, RoundType } from "@/lib/shared/types";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Reports Preview",
  "Internal Trailgrad reports preview for design review."
);

const DAY = 86_400_000;

function competency(label: string, score: number, answered = true): InterviewCompetencyReport {
  return {
    label,
    question: `Walk me through a time ${label.toLowerCase()} was the deciding factor.`,
    answered,
    answerPreview: answered
      ? "We were seeing 400ms p95 on the dashboard, so I profiled the render path and…"
      : null,
    evidenceScore: answered ? score : 0,
    evidenceLevel: answered ? (score >= 75 ? "strong" : "developing") : "missing",
    signals: answered ? ["Personal ownership", "Outcome or measurement"] : [],
    gap: "Close with a measurable result or what you learned.",
    nextStep: `Retell the ${label.toLowerCase()} story ending on the number it moved.`
  };
}

/** Six rounds over five weeks, improving unevenly — the shape real use produces. */
function mockReports(now: number): InterviewReport[] {
  const rounds: Array<{
    id: string;
    daysAgo: number;
    roundType: RoundType;
    status: InterviewReport["status"];
    competencies: InterviewCompetencyReport[];
    interaction: InterviewReport["interaction"];
  }> = [
    {
      id: "r1",
      daysAgo: 34,
      roundType: "behavioral",
      status: "completed",
      competencies: [
        competency("Ownership", 38),
        competency("Communication", 44),
        competency("Impact", 52)
      ],
      interaction: { probes: 5, challenges: 2, clarifications: 3, interruptions: 1 }
    },
    {
      id: "r2",
      daysAgo: 27,
      roundType: "technical",
      status: "completed",
      competencies: [
        competency("Technical depth", 55),
        competency("Ownership", 47),
        competency("System design", 41)
      ],
      interaction: { probes: 4, challenges: 3, clarifications: 2, interruptions: 1 }
    },
    {
      id: "r3",
      daysAgo: 18,
      roundType: "behavioral",
      status: "completed",
      competencies: [
        competency("Ownership", 61),
        competency("Communication", 58),
        competency("Impact", 66)
      ],
      interaction: { probes: 3, challenges: 2, clarifications: 2, interruptions: 0 }
    },
    {
      id: "r4",
      daysAgo: 11,
      roundType: "technical",
      status: "completed",
      competencies: [
        competency("Technical depth", 78),
        competency("System design", 49),
        competency("Ownership", 70)
      ],
      interaction: { probes: 3, challenges: 4, clarifications: 1, interruptions: 0 }
    },
    {
      id: "r5",
      daysAgo: 4,
      roundType: "hiring-manager",
      status: "completed",
      competencies: [
        competency("Ownership", 76),
        competency("Impact", 81),
        competency("Communication", 64),
        competency("Scope judgement", 0, false)
      ],
      interaction: { probes: 2, challenges: 3, clarifications: 1, interruptions: 0 }
    },
    {
      id: "r6",
      daysAgo: 1,
      roundType: "technical",
      status: "completed",
      competencies: [
        competency("Technical depth", 84),
        competency("System design", 58),
        competency("Communication", 72)
      ],
      interaction: { probes: 2, challenges: 2, clarifications: 1, interruptions: 0 }
    }
  ];

  return rounds.map((round) => {
    const answered = round.competencies.filter((item) => item.answered);
    const startedAt = now - round.daysAgo * DAY;

    return {
      sessionId: round.id,
      status: round.status,
      setup: {
        role: "frontend",
        level: "3-5",
        roundType: round.roundType,
        intensity: "realistic",
        context: "Rebuilt the analytics dashboard and its data-fetching layer."
      },
      startedAt,
      updatedAt: startedAt + 22 * 60_000,
      durationMs: (18 + round.daysAgo / 6) * 60_000,
      questionCount: round.competencies.length,
      questionsCovered: answered.length,
      answerCount: answered.length,
      competencies: round.competencies,
      interaction: round.interaction,
      codeExercise:
        round.roundType === "technical"
          ? { language: "TypeScript", task: "Debounce a search input.", submitted: true }
          : null,
      summary: {
        evidenceScore: Math.round(
          answered.reduce((total, item) => total + item.evidenceScore, 0) / answered.length
        ),
        strongest:
          [...answered].sort((a, b) => b.evidenceScore - a.evidenceScore)[0]?.label ?? null,
        recommendedFocus:
          [...answered].sort((a, b) => a.evidenceScore - b.evidenceScore)[0]?.label ?? null,
        nextStep: "Open with the constraint you were under, then the decision, then the number."
      },
      transcript: []
    } satisfies InterviewReport;
  });
}

/** Dev-only harness so the Reports layout can be reviewed without a session. */
export default function ReportsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const now = Date.now();

  return (
    <WorkspaceShell>
      <ReportsView
        overview={createReportsOverview(mockReports(now), now)}
        quota={{ used: 1, limit: 2 }}
        firstName="Nikhil"
        candidate={{ name: "Nikhil Verma", discipline: "Full Stack Engineering" }}
      />
    </WorkspaceShell>
  );
}
