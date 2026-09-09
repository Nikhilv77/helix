import {
  AppliedEngineeringAssessmentStatus,
  AppliedEngineeringQuestionStatus,
  Prisma
} from "@prisma/client";
import {
  appliedEngineeringAssessmentReportSchema,
  appliedEngineeringSafeTranscriptSchema
} from "@/features/practice/applied-engineering/domain/assessment-contracts";
import { selectedAppliedEngineeringIncidentSchema } from "@/features/practice/applied-engineering/domain/incident-contracts";
import { publicAppliedEngineeringQuestionSchema } from "@/features/practice/applied-engineering/domain/question-contracts";
import type { AppliedEngineeringPracticeAnalytics } from "@/features/practice/applied-engineering/domain/workspace-analytics";
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
const APPLIED_ENGINEERING_TEMPLATE_ID = "applied-engineering";

const practiceQuestionSelect = {
  id: true,
  blockId: true,
  order: true,
  status: true,
  publicSnapshot: true,
  completedAt: true,
  learnedAt: true,
  block: { select: { isCurrent: true, incidentSnapshot: true } }
} satisfies Prisma.AppliedEngineeringBlockQuestionSelect;

const assessmentRoundSelect = {
  id: true,
  status: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  block: { select: { id: true, incidentSnapshot: true } },
  report: {
    select: { reportSnapshot: true, transcriptSnapshot: true, finalizedAt: true }
  }
} satisfies Prisma.AppliedEngineeringAssessmentSelect;

type AssessmentRound = Prisma.AppliedEngineeringAssessmentGetPayload<{
  select: typeof assessmentRoundSelect;
}>;

export interface AppliedEngineeringRoundAnalytics {
  history: InterviewHistoryItem[];
  reports: InterviewReport[];
}

/** Read-only bridge from Applied Engineering snapshots into workspace analytics. */
export class AppliedEngineeringWorkspaceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async practice(
    ownerId: string,
    days = 126,
    now: Date = new Date()
  ): Promise<AppliedEngineeringPracticeAnalytics> {
    const dayCount = Math.max(1, Math.min(days, 126));
    const today = startOfUtcDay(now);
    const windowStart = new Date(today.getTime() - (dayCount - 1) * DAY_MS);
    const [questions, attempts] = await Promise.all([
      this.prisma.appliedEngineeringBlockQuestion.findMany({
        where: { ownerId },
        orderBy: [{ block: { ordinal: "asc" } }, { order: "asc" }],
        select: practiceQuestionSelect
      }),
      this.prisma.appliedEngineeringQuestionAttempt.findMany({
        where: { ownerId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      })
    ]);
    const completed = questions.filter(
      (question) =>
        question.status === AppliedEngineeringQuestionStatus.COMPLETED ||
        question.status === AppliedEngineeringQuestionStatus.LEARNED
    );
    const solvedByDay = countDates(
      completed.flatMap((question) => {
        const terminalAt = question.completedAt ?? question.learnedAt;
        return terminalAt ? [terminalAt] : [];
      })
    );
    const attemptsByDay = countDates(attempts.map((attempt) => attempt.createdAt));
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
      (question) =>
        question.block.isCurrent && question.status === AppliedEngineeringQuestionStatus.ACTIVE
    );

    return {
      totalQuestions: questions.length,
      completedQuestions: completed.length,
      totalAttempts: attempts.length,
      solvedThisWeek: activity
        .filter((day) => Date.parse(`${day.date}T00:00:00.000Z`) >= startOfUtcWeek(now).getTime())
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
  ): Promise<AppliedEngineeringRoundAnalytics> {
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    const [profile, assessments] = await Promise.all([
      this.prisma.candidateProfile.findUnique({
        where: { ownerId },
        select: { targetRole: true, level: true }
      }),
      this.prisma.appliedEngineeringAssessment.findMany({
        where: {
          ownerId,
          status: {
            in: [
              AppliedEngineeringAssessmentStatus.IN_PROGRESS,
              AppliedEngineeringAssessmentStatus.FINALIZING,
              AppliedEngineeringAssessmentStatus.COMPLETED
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
    const history = assessments.map((assessment) => toHistory(assessment, role, level, now));
    const reports = assessments.flatMap((assessment) =>
      assessment.report ? [toReport(assessment, role, level, now)] : []
    );
    return { history, reports };
  }
}

function nextQuestion(
  question: Prisma.AppliedEngineeringBlockQuestionGetPayload<{
    select: typeof practiceQuestionSelect;
  }>
) {
  const incident = selectedAppliedEngineeringIncidentSchema.parse(question.block.incidentSnapshot);
  const snapshot = publicAppliedEngineeringQuestionSchema.parse(question.publicSnapshot);
  const stage = incident.stages.find((item) => item.order === question.order);
  return {
    title: stage?.title ?? `Question ${question.order}`,
    href: `/practice/applied-engineering/questions/${encodeURIComponent(question.id)}?block=${encodeURIComponent(question.blockId)}`,
    chapterTitle: incident.title,
    difficulty: incident.difficulty,
    minutes: questionMinutes(snapshot.format, incident.expectedMinutes)
  };
}

function toHistory(
  assessment: AssessmentRound,
  role: Role,
  level: Level,
  now: number
): InterviewHistoryItem {
  const incident = selectedAppliedEngineeringIncidentSchema.parse(assessment.block.incidentSnapshot);
  const completed = assessment.status === AppliedEngineeringAssessmentStatus.COMPLETED;
  const startedAt = (assessment.startedAt ?? assessment.createdAt).getTime();
  const endedAt = assessment.completedAt?.getTime() ?? now;
  const answerCount =
    completed || assessment.status === AppliedEngineeringAssessmentStatus.FINALIZING ? 5 : 0;
  return {
    sessionId: appliedEngineeringSessionId(assessment.id),
    status: completed ? "completed" : "in_progress",
    setup: {
      role,
      level,
      roundType: "technical",
      intensity: incidentIntensity(incident.difficulty),
      context: incident.incident,
      agenda: incident.productionSignalKeys,
      templateId: APPLIED_ENGINEERING_TEMPLATE_ID,
      templateTitle: `Applied Engineering · ${incident.title}`,
      durationMinutes: incident.expectedMinutes,
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
  if (!assessment.report) throw new Error("Applied Engineering report snapshot is missing");
  const history = toHistory(assessment, role, level, now);
  const report = appliedEngineeringAssessmentReportSchema.parse(assessment.report.reportSnapshot);
  const transcript = appliedEngineeringSafeTranscriptSchema.parse(
    assessment.report.transcriptSnapshot
  );
  const entries = new Map(transcript.entries.map((entry) => [entry.promptId, entry]));
  const dimensions = [
    ["Diagnosis & evidence", report.scores.diagnosisEvidence],
    ["Implementation correctness", report.scores.implementationCorrectness],
    ["Testing & verification", report.scores.testingVerification],
    ["Production judgment", report.scores.productionJudgment],
    ["Ownership & safe delivery", report.scores.ownershipDelivery]
  ] as const;
  const competencies = dimensions.map(([label, score], index): InterviewCompetencyReport => {
    const feedback = report.promptFeedback[index];
    const entry = feedback ? entries.get(feedback.promptId) : transcript.entries[index];
    return {
      label,
      question: entry?.prompt ?? label,
      evidenceAnchor: entry?.kind ?? null,
      answered: Boolean(entry?.answer),
      answerPreview: entry?.answer ? compact(entry.answer, 180) : null,
      evidenceScore: score,
      evidenceLevel: score >= 75 ? "strong" : score >= 45 ? "developing" : "missing",
      evidenceBreakdown: {
        ownership: report.scores.ownershipDelivery,
        decision: report.scores.productionJudgment,
        specificity: report.scores.diagnosisEvidence,
        outcome: report.scores.testingVerification
      },
      signals: report.strengths,
      gap: report.improvementAreas[index % report.improvementAreas.length] ?? report.teacherSummary,
      nextStep: feedback?.feedback ?? report.teacherSummary,
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
        summary: feedback?.feedback ?? report.teacherSummary,
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
      nextStep: report.improvementAreas[0] ?? report.teacherSummary
    },
    transcript: transcriptTurns(transcript.entries)
  };
}

function transcriptTurns(
  entries: ReturnType<typeof appliedEngineeringSafeTranscriptSchema.parse>["entries"]
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

function questionMinutes(format: string, expectedMinutes: number): number {
  const weight =
    format === "debug-repair" || format === "micro-implementation"
      ? 1.35
      : format === "mcq"
        ? 0.6
        : 1;
  const totalWeight = 8.3;
  return Math.max(2, Math.round((expectedMinutes * weight) / totalWeight));
}

function appliedEngineeringSessionId(assessmentId: string) {
  return `applied-engineering:${assessmentId}`;
}

function incidentIntensity(difficulty: "guided" | "standard" | "stretch"): Intensity {
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
  return ["fresher", "0-2", "3-5", "5-plus"].includes(value ?? "")
    ? (value as Level)
    : "3-5";
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
