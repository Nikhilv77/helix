import { ArchitectureAssessmentStatus, ArchitectureQuestionStatus, Prisma } from "@prisma/client";
import {
  architectureDesignAssessmentReportSchema,
  architectureDesignSafeTranscriptSchema
} from "@/lib/practice/architecture-design/assessment-contracts";
import { architectureDesignScenarioSelectionSchema } from "@/lib/practice/architecture-design/focus-ranking-contracts";
import { publicArchitectureDesignQuestionSchema } from "@/lib/practice/architecture-design/question-contracts";
import { architectureDesignScenarioSchema } from "@/lib/practice/architecture-design/scenario-contracts";
import type { ArchitectureDesignPracticeAnalytics } from "@/lib/practice/architecture-design/workspace-analytics";
import type {
  InterviewCompetencyReport,
  InterviewHistoryItem,
  InterviewReport,
  Intensity,
  Level,
  Role,
  Turn
} from "@/lib/shared/types";
import type { PrismaService } from "@/server/database/prisma.service";

const DAY_MS = 86_400_000;
const TEMPLATE_ID = "architecture-design";

const practiceQuestionSelect = {
  id: true,
  blockId: true,
  order: true,
  status: true,
  publicSnapshot: true,
  completedAt: true,
  learnedAt: true,
  block: {
    select: { isCurrent: true, scenarioSnapshot: true, selectionSnapshot: true }
  }
} satisfies Prisma.ArchitectureBlockQuestionSelect;

const assessmentRoundSelect = {
  id: true,
  status: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  block: {
    select: { id: true, scenarioSnapshot: true, selectionSnapshot: true }
  },
  report: {
    select: { reportSnapshot: true, transcriptSnapshot: true, finalizedAt: true }
  }
} satisfies Prisma.ArchitectureAssessmentSelect;

type AssessmentRound = Prisma.ArchitectureAssessmentGetPayload<{
  select: typeof assessmentRoundSelect;
}>;

export interface ArchitectureDesignRoundAnalytics {
  history: InterviewHistoryItem[];
  reports: InterviewReport[];
}

/** Read-only projection from immutable Architecture snapshots into workspace analytics. */
export class ArchitectureDesignWorkspaceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async practice(
    ownerId: string,
    days = 126,
    now: Date = new Date()
  ): Promise<ArchitectureDesignPracticeAnalytics> {
    const dayCount = Math.max(1, Math.min(days, 126));
    const today = startOfUtcDay(now);
    const windowStart = new Date(today.getTime() - (dayCount - 1) * DAY_MS);
    const [questions, attempts] = await Promise.all([
      this.prisma.architectureBlockQuestion.findMany({
        where: { ownerId },
        orderBy: [{ block: { ordinal: "asc" } }, { order: "asc" }],
        select: practiceQuestionSelect
      }),
      this.prisma.architectureQuestionAttempt.findMany({
        where: { ownerId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      })
    ]);
    const terminal = questions.filter(
      ({ status }) =>
        status === ArchitectureQuestionStatus.COMPLETED ||
        status === ArchitectureQuestionStatus.LEARNED
    );
    const solvedByDay = countDates(
      terminal.flatMap((question) => {
        const terminalAt = question.completedAt ?? question.learnedAt;
        return terminalAt ? [terminalAt] : [];
      })
    );
    const attemptsByDay = countDates(attempts.map(({ createdAt }) => createdAt));
    const activity = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(windowStart.getTime() + index * DAY_MS);
      const key = dayKey(date);
      return {
        date: key,
        solved: solvedByDay.get(key) ?? 0,
        attempts: attemptsByDay.get(key) ?? 0
      };
    });
    const activeQuestion = questions.find(
      ({ block, status }) => block.isCurrent && status === ArchitectureQuestionStatus.ACTIVE
    );
    return {
      totalQuestions: questions.length,
      completedQuestions: terminal.length,
      totalAttempts: attempts.length,
      solvedThisWeek: activity
        .filter(({ date }) => Date.parse(`${date}T00:00:00.000Z`) >= startOfUtcWeek(now).getTime())
        .reduce((total, day) => total + day.solved, 0),
      currentStreakDays: currentStreak(new Set(solvedByDay.keys()), now),
      lastActiveAt: attempts[0]?.createdAt.getTime() ?? null,
      activity,
      nextUp: activeQuestion ? nextQuestion(activeQuestion) : null
    };
  }

  async rounds(
    ownerId: string,
    limit = 50,
    now = Date.now()
  ): Promise<ArchitectureDesignRoundAnalytics> {
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    const [profile, assessments] = await Promise.all([
      this.prisma.candidateProfile.findUnique({
        where: { ownerId },
        select: { targetRole: true, level: true }
      }),
      this.prisma.architectureAssessment.findMany({
        where: {
          ownerId,
          status: {
            in: [
              ArchitectureAssessmentStatus.IN_PROGRESS,
              ArchitectureAssessmentStatus.FINALIZING,
              ArchitectureAssessmentStatus.COMPLETED
            ]
          }
        },
        orderBy: { updatedAt: "desc" },
        take: boundedLimit,
        select: assessmentRoundSelect
      })
    ]);
    const role = asRole(profile?.targetRole);
    const level = asLevel(profile?.level);
    return {
      history: assessments.map((assessment) => toHistory(assessment, role, level, now)),
      reports: assessments.flatMap((assessment) =>
        assessment.report ? [toReport(assessment, role, level, now)] : []
      )
    };
  }
}

function nextQuestion(
  question: Prisma.ArchitectureBlockQuestionGetPayload<{ select: typeof practiceQuestionSelect }>
) {
  const scenario = architectureDesignScenarioSchema.parse(question.block.scenarioSnapshot);
  const selection = architectureDesignScenarioSelectionSchema.parse(
    question.block.selectionSnapshot
  );
  const snapshot = publicArchitectureDesignQuestionSchema.parse(question.publicSnapshot);
  const stage = scenario.stages.find(({ order }) => order === question.order);
  return {
    title: stage?.title ?? `Question ${question.order}`,
    href: `/practice/architecture-design/questions/${encodeURIComponent(question.id)}?block=${encodeURIComponent(question.blockId)}`,
    chapterTitle: scenario.title,
    difficulty: selection.selectedScenario.difficulty,
    minutes: questionMinutes(snapshot.format, scenario.expectedMinutes)
  };
}

function toHistory(
  assessment: AssessmentRound,
  role: Role,
  level: Level,
  now: number
): InterviewHistoryItem {
  const scenario = architectureDesignScenarioSchema.parse(assessment.block.scenarioSnapshot);
  const selection = architectureDesignScenarioSelectionSchema.parse(
    assessment.block.selectionSnapshot
  );
  const completed = assessment.status === ArchitectureAssessmentStatus.COMPLETED;
  const startedAt = (assessment.startedAt ?? assessment.createdAt).getTime();
  const endedAt = assessment.completedAt?.getTime() ?? now;
  const answerCount =
    completed || assessment.status === ArchitectureAssessmentStatus.FINALIZING ? 5 : 0;
  return {
    sessionId: sessionId(assessment.id),
    status: completed ? "completed" : "in_progress",
    setup: {
      role,
      level,
      roundType: "technical",
      intensity: scenarioIntensity(selection.selectedScenario.difficulty),
      context: scenario.premise,
      agenda: [scenario.primaryTopicKey, ...scenario.secondaryTopicKeys],
      templateId: TEMPLATE_ID,
      templateTitle: `Architecture & Design · ${scenario.title}`,
      durationMinutes: scenario.expectedMinutes,
      questionCount: 5
    },
    startedAt,
    updatedAt: assessment.updatedAt.getTime(),
    durationMs: Math.max(0, endedAt - startedAt),
    questionCount: 5,
    questionsCovered: answerCount,
    answerCount
  };
}

function toReport(
  assessment: AssessmentRound,
  role: Role,
  level: Level,
  now: number
): InterviewReport {
  if (!assessment.report) throw new Error("Architecture report snapshot is missing");
  const history = toHistory(assessment, role, level, now);
  const report = architectureDesignAssessmentReportSchema.parse(assessment.report.reportSnapshot);
  const transcript = architectureDesignSafeTranscriptSchema.parse(
    assessment.report.transcriptSnapshot
  );
  const dimensions = [
    ["Requirements & scope", report.scores.requirementsScope],
    ["API, data & capacity", report.scores.apiDataCapacity],
    ["Architecture & trade-offs", report.scores.architectureTradeoffs],
    ["Reliability, security & operability", report.scores.reliabilitySecurityOperability],
    ["Communication & evolution", report.scores.communicationEvolution]
  ] as const;
  const competencies = dimensions.map(([label, score], index): InterviewCompetencyReport => {
    const entry = transcript.entries[index];
    return {
      label,
      question: entry?.prompt ?? label,
      evidenceAnchor: entry?.kind ?? null,
      answered: Boolean(entry?.answer),
      answerPreview: entry?.answer ? compact(entry.answer, 180) : null,
      evidenceScore: score,
      evidenceLevel: score >= 75 ? "strong" : score >= 45 ? "developing" : "missing",
      evidenceBreakdown: {
        ownership: report.scores.communicationEvolution,
        decision: report.scores.architectureTradeoffs,
        specificity: report.scores.apiDataCapacity,
        outcome: report.scores.reliabilitySecurityOperability
      },
      signals: report.strengths,
      gap: report.improvementAreas[index % report.improvementAreas.length] ?? report.teacherSummary,
      nextStep: report.nextSteps[index % report.nextSteps.length] ?? report.teacherSummary,
      technicalEvaluation: {
        source: "semantic-evaluator",
        score,
        verdict:
          score >= 85
            ? "correct"
            : score >= 70
              ? "mostly-correct"
              : score >= 45
                ? "partially-correct"
                : "incorrect",
        confidence: 1,
        summary: report.teacherSummary,
        strengths: report.strengths,
        gaps: report.improvementAreas,
        rubricScores: [],
        execution: null
      }
    };
  });
  const strongest = [...dimensions].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const focus = [...dimensions].sort((left, right) => left[1] - right[1])[0]?.[0] ?? null;
  return {
    ...history,
    status: "completed",
    questionsCovered: transcript.entries.length,
    answerCount: transcript.entries.length,
    competencies,
    interaction: { probes: 0, challenges: 0, clarifications: 0, interruptions: 0 },
    codeExercise: null,
    summary: {
      evidenceScore: report.overallScore,
      strongest,
      recommendedFocus: focus,
      nextStep: report.nextSteps[0] ?? report.teacherSummary
    },
    transcript: transcriptTurns(transcript.entries)
  };
}

function transcriptTurns(
  entries: ReturnType<typeof architectureDesignSafeTranscriptSchema.parse>["entries"]
): Turn[] {
  return entries.flatMap((entry, index) => {
    const startMs = index * 2_000;
    return [
      {
        speaker: "agent" as const,
        text: entry.prompt,
        startMs,
        endMs: startMs,
        questionIndex: index
      },
      {
        speaker: "user" as const,
        text: entry.answer,
        startMs: startMs + 1,
        endMs: startMs + 1,
        questionIndex: index
      }
    ];
  });
}

function questionMinutes(format: string, expectedMinutes: number) {
  return Math.max(2, Math.round((expectedMinutes * (format === "mcq" ? 0.6 : 1)) / 4));
}

function sessionId(assessmentId: string) {
  return `architecture-design:${assessmentId}`;
}

function scenarioIntensity(difficulty: "guided" | "standard" | "stretch"): Intensity {
  if (difficulty === "guided") return "friendly";
  if (difficulty === "stretch") return "brutal";
  return "realistic";
}

function asRole(value: string | null | undefined): Role {
  return ["backend", "frontend", "fullstack", "data", "ai-ml", "pm"].includes(value ?? "")
    ? (value as Role)
    : "backend";
}

function asLevel(value: string | null | undefined): Level {
  return ["fresher", "0-2", "3-5", "5-plus"].includes(value ?? "") ? (value as Level) : "3-5";
}

function compact(value: string, length: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= length ? normalized : `${normalized.slice(0, length - 1)}…`;
}

function countDates(dates: Date[]) {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function currentStreak(solvedDays: Set<string>, now: Date) {
  const cursor = startOfUtcDay(now);
  if (!solvedDays.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (solvedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function startOfUtcWeek(date: Date) {
  const start = startOfUtcDay(date);
  const weekday = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return start;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
