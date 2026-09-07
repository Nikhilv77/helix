import { CoreTechnicalAssessmentStatus, CoreTechnicalQuestionStatus, Prisma } from "@prisma/client";
import {
  coreTechnicalAssessmentReportSchema,
  coreTechnicalSafeTranscriptSchema
} from "@/lib/practice/core-technical/assessment-contracts";
import { publicCoreTechnicalQuestionSchema } from "@/lib/practice/core-technical/question-contracts";
import { selectedStorySchema } from "@/lib/practice/core-technical/story-contracts";
import { coreTechnicalQuestionMinutes } from "@/lib/practice/core-technical/ui-state";
import type { CoreTechnicalPracticeAnalytics } from "@/lib/practice/core-technical/workspace-analytics";
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
const CORE_TECHNICAL_TEMPLATE_ID = "core-technical";

const practiceQuestionSelect = {
  id: true,
  blockId: true,
  order: true,
  status: true,
  publicSnapshot: true,
  completedAt: true,
  learnedAt: true,
  block: {
    select: {
      isCurrent: true,
      storySnapshot: true
    }
  }
} satisfies Prisma.CoreTechnicalBlockQuestionSelect;

const assessmentRoundSelect = {
  id: true,
  status: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  block: {
    select: {
      id: true,
      storySnapshot: true
    }
  },
  report: {
    select: {
      reportSnapshot: true,
      transcriptSnapshot: true,
      finalizedAt: true
    }
  }
} satisfies Prisma.CoreTechnicalAssessmentSelect;

type AssessmentRound = Prisma.CoreTechnicalAssessmentGetPayload<{
  select: typeof assessmentRoundSelect;
}>;

export interface CoreTechnicalRoundAnalytics {
  history: InterviewHistoryItem[];
  reports: InterviewReport[];
}

/**
 * Read-only bridge from the story-driven Core Technical tables into the
 * established workspace counters. It does not write compatibility rows or
 * make Core Technical depend on the legacy roadmap/session persistence.
 */
export class CoreTechnicalWorkspaceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async practice(
    ownerId: string,
    days = 126,
    now: Date = new Date()
  ): Promise<CoreTechnicalPracticeAnalytics> {
    const dayCount = Math.max(1, Math.min(days, 126));
    const today = startOfUtcDay(now);
    const windowStart = new Date(today.getTime() - (dayCount - 1) * DAY_MS);
    const [questions, attempts] = await Promise.all([
      this.prisma.coreTechnicalBlockQuestion.findMany({
        where: { ownerId },
        orderBy: [{ block: { ordinal: "asc" } }, { order: "asc" }],
        select: practiceQuestionSelect
      }),
      this.prisma.coreTechnicalQuestionAttempt.findMany({
        where: { ownerId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      })
    ]);

    const completed = questions.filter(
      (question) =>
        question.status === CoreTechnicalQuestionStatus.COMPLETED ||
        question.status === CoreTechnicalQuestionStatus.LEARNED
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
        question.block.isCurrent && question.status === CoreTechnicalQuestionStatus.ACTIVE
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
  ): Promise<CoreTechnicalRoundAnalytics> {
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    const [profile, assessments] = await Promise.all([
      this.prisma.candidateProfile.findUnique({
        where: { ownerId },
        select: { targetRole: true, level: true }
      }),
      this.prisma.coreTechnicalAssessment.findMany({
        where: {
          ownerId,
          status: {
            in: [
              CoreTechnicalAssessmentStatus.IN_PROGRESS,
              CoreTechnicalAssessmentStatus.FINALIZING,
              CoreTechnicalAssessmentStatus.COMPLETED
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
    const reports = assessments.flatMap((assessment) => {
      if (!assessment.report) return [];
      return [toReport(assessment, role, level, now)];
    });
    return { history, reports };
  }
}

function nextQuestion(
  question: Prisma.CoreTechnicalBlockQuestionGetPayload<{ select: typeof practiceQuestionSelect }>
) {
  const story = selectedStorySchema.parse(question.block.storySnapshot);
  const snapshot = publicCoreTechnicalQuestionSchema.parse(question.publicSnapshot);
  const stage = story.stages.find((item) => item.order === question.order);
  return {
    title: stage?.title ?? `Question ${question.order}`,
    href: `/practice/core-technical/questions/${encodeURIComponent(question.id)}?block=${encodeURIComponent(question.blockId)}`,
    chapterTitle: story.title,
    difficulty: story.difficulty,
    minutes: coreTechnicalQuestionMinutes(snapshot.format, story.expectedMinutes)
  };
}

function toHistory(
  assessment: AssessmentRound,
  role: Role,
  level: Level,
  now: number
): InterviewHistoryItem {
  const story = selectedStorySchema.parse(assessment.block.storySnapshot);
  const completed = assessment.status === CoreTechnicalAssessmentStatus.COMPLETED;
  const startedAt = (assessment.startedAt ?? assessment.createdAt).getTime();
  const endedAt = assessment.completedAt?.getTime() ?? now;
  const answerCount =
    completed || assessment.status === CoreTechnicalAssessmentStatus.FINALIZING ? 5 : 0;

  return {
    sessionId: coreTechnicalSessionId(assessment.id),
    status: completed ? "completed" : "in_progress",
    setup: {
      role,
      level,
      roundType: "technical",
      intensity: storyIntensity(story.difficulty),
      context: story.premise,
      agenda: story.mechanismKeys,
      templateId: CORE_TECHNICAL_TEMPLATE_ID,
      templateTitle: `Core Technical · ${story.title}`,
      durationMinutes: story.expectedMinutes,
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
  if (!assessment.report) throw new Error("Core Technical report snapshot is missing");
  const history = toHistory(assessment, role, level, now);
  const report = coreTechnicalAssessmentReportSchema.parse(assessment.report.reportSnapshot);
  const transcript = coreTechnicalSafeTranscriptSchema.parse(assessment.report.transcriptSnapshot);
  const entries = new Map(transcript.entries.map((entry) => [entry.promptId, entry]));
  const dimensions = [
    ["Technical accuracy", report.scores.technicalAccuracy],
    ["Mechanism reasoning", report.scores.mechanismReasoning],
    ["Diagnosis & evidence", report.scores.diagnosisEvidence],
    ["Debugging & implementation", report.scores.debuggingImplementation],
    ["Production communication", report.scores.communicationProduction]
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
        ownership: report.scores.technicalAccuracy,
        decision: report.scores.mechanismReasoning,
        specificity: report.scores.diagnosisEvidence,
        outcome: report.scores.communicationProduction
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
  entries: ReturnType<typeof coreTechnicalSafeTranscriptSchema.parse>["entries"]
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

function coreTechnicalSessionId(assessmentId: string): string {
  return `core-technical:${assessmentId}`;
}

function storyIntensity(difficulty: "guided" | "standard" | "stretch"): Intensity {
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

function compact(value: string, length: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= length ? normalized : `${normalized.slice(0, length - 1)}…`;
}

function countDates(dates: Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function currentStreak(solvedDays: Set<string>, now: Date): number {
  const cursor = startOfUtcDay(now);
  if (!solvedDays.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (solvedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function startOfUtcWeek(date: Date): Date {
  const start = startOfUtcDay(date);
  const weekday = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return start;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
