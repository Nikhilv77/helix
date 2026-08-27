import { MAYA, personaById } from "@/lib/avatars/personas";
import type { PrismaService } from "../database/prisma.service";
import type { NotificationDispatcher } from "./notification-dispatcher";
import { NotificationKind } from "./notification.service";

const DAILY_BATCH_LIMIT = 250;

export interface WelcomeNotificationInput {
  ownerId: string;
  teacherId: string | null;
  candidateName: string;
  targetRole: string;
  focusAreas: string[];
}

export interface DailyDispatchSummary {
  candidates: number;
  recorded: number;
  failed: number;
}

/**
 * Teacher-authored lifecycle messaging.
 *
 * Copy selection is deliberately deterministic. Recommendations use the same
 * saved roadmap and draft state the learner sees, cost no model call, and are
 * reproducible when a cron invocation is retried.
 */
export class TeacherNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher
  ) {}

  async welcome(input: WelcomeNotificationInput) {
    const teacher = personaById(input.teacherId) ?? MAYA;
    const focus = input.focusAreas[0]?.trim() || humanizeRole(input.targetRole);
    const candidate = firstName(input.candidateName) || "there";

    return this.dispatcher.dispatch({
      ownerId: input.ownerId,
      kind: NotificationKind.TEACHER_WELCOME,
      title: `${teacher.name} has your first practice path ready`,
      body: `I’ve reviewed your resume and shaped your first steps around ${focus}. Start with one focused question—I’ll guide you from there.`,
      href: "/practice",
      subjectId: "onboarding-v1",
      email: {
        subject: `${teacher.name} from Trailgrad — your practice path is ready`,
        body: [
          `Hi ${candidate},`,
          "",
          `I’m ${teacher.name}, your teacher at Trailgrad.`,
          "",
          `I’ve reviewed the experience and projects in your resume and prepared a practice path around ${focus} and the areas you’ll most likely need to explain and defend during interviews.`,
          "",
          "I’ll guide you one question at a time—what to practise, why it matters, and when you’re ready to move forward.",
          "",
          "Start with your first recommended practice question:",
          "",
          "You don’t need to complete everything today. One focused question is enough to begin building a real readiness signal.",
          "",
          "See you inside,",
          teacher.name,
          "Your teacher at Trailgrad"
        ].join("\n")
      }
    });
  }

  async dispatchDaily(now = new Date()): Promise<DailyDispatchSummary> {
    const profiles = await this.prisma.candidateProfile.findMany({
      where: {
        onboardingCompletedAt: { not: null },
        teacherNotificationsEnabled: true
      },
      select: {
        ownerId: true,
        teacherId: true
      },
      orderBy: { ownerId: "asc" },
      take: DAILY_BATCH_LIMIT
    });

    const summary: DailyDispatchSummary = {
      candidates: profiles.length,
      recorded: 0,
      failed: 0
    };
    const dateKey = utcDateKey(now);

    for (const profile of profiles) {
      try {
        summary.recorded += await this.dispatchForCandidate(
          profile.ownerId,
          profile.teacherId,
          dateKey
        );
      } catch {
        // One malformed legacy roadmap must not prevent everyone after it from
        // receiving a recommendation in the same bounded cron invocation.
        summary.failed += 1;
      }
    }

    return summary;
  }

  private async dispatchForCandidate(
    ownerId: string,
    teacherId: string | null,
    dateKey: string
  ): Promise<number> {
    const teacher = personaById(teacherId) ?? MAYA;
    const questions = await this.prisma.userQuestionProgress.findMany({
      where: {
        roadmap: { ownerId },
        completedAt: null,
        status: { in: ["ACTIVE", "IN_PROGRESS"] }
      },
      select: {
        id: true,
        order: true,
        attemptCount: true,
        lastAttemptedAt: true,
        draftUpdatedAt: true,
        dsaQuestionSlug: true,
        prepQuestionTemplateId: true,
        sessionProgress: { select: { practiceSessionKey: true } },
        dsaQuestion: {
          select: {
            title: true,
            primaryPattern: true,
            promptSummary: true
          }
        },
        prepQuestionTemplate: {
          select: {
            title: true,
            competency: true,
            whatItTests: true
          }
        }
      },
      orderBy: [{ order: "asc" }],
      take: 12
    });

    const unfinished = questions
      .filter(
        (question) =>
          question.draftUpdatedAt !== null ||
          question.lastAttemptedAt !== null ||
          question.attemptCount > 0
      )
      .sort((left, right) => activityTime(right) - activityTime(left))[0];
    const primary = questions.find((question) => question.id !== unfinished?.id) ?? null;
    let recorded = 0;

    if (primary) {
      const detail = questionDetail(primary);
      const result = await this.dispatcher.dispatch({
        ownerId,
        kind: NotificationKind.TEACHER_RECOMMENDATION,
        title: `Try “${detail.title}” today`,
        body: `${detail.reason} Keep it focused: one complete answer is enough for today.`,
        href: detail.href,
        subjectId: `${dateKey}:primary`
      });
      if (result.recorded) recorded += 1;
    } else if (!unfinished) {
      const result = await this.dispatcher.dispatch({
        ownerId,
        kind: NotificationKind.TEACHER_RECOMMENDATION,
        title: `${teacher.name} has one small step for today`,
        body: "Open your practice path and complete one focused question. Consistency matters more than a long session.",
        href: "/practice",
        subjectId: `${dateKey}:primary`
      });
      if (result.recorded) recorded += 1;
    }

    if (unfinished) {
      const detail = questionDetail(unfinished);
      const result = await this.dispatcher.dispatch({
        ownerId,
        kind: NotificationKind.TEACHER_REMINDER,
        title: `Your work on “${detail.title}” is waiting`,
        body: "Your draft and attempts are saved. Finish this one before starting something new, while your reasoning is still fresh.",
        href: detail.href,
        subjectId: `${dateKey}:unfinished:${unfinished.id}`
      });
      if (result.recorded) recorded += 1;
    }

    return recorded;
  }
}

interface DailyQuestion {
  id: string;
  attemptCount: number;
  draftUpdatedAt: Date | null;
  lastAttemptedAt: Date | null;
  dsaQuestionSlug: string | null;
  prepQuestionTemplateId: string | null;
  sessionProgress: { practiceSessionKey: string };
  dsaQuestion: { title: string; primaryPattern: string; promptSummary: string } | null;
  prepQuestionTemplate: { title: string; competency: string; whatItTests: string[] } | null;
}

function questionDetail(question: DailyQuestion): {
  title: string;
  reason: string;
  href: string;
} {
  if (question.dsaQuestion && question.dsaQuestionSlug) {
    return {
      title: question.dsaQuestion.title,
      reason: `It sharpens ${question.dsaQuestion.primaryPattern}, a pattern worth being able to explain under pressure.`,
      href: `/dsa-questions/${encodeURIComponent(question.dsaQuestionSlug)}`
    };
  }

  if (question.prepQuestionTemplate && question.prepQuestionTemplateId) {
    const signal = question.prepQuestionTemplate.whatItTests[0];
    return {
      title: question.prepQuestionTemplate.title,
      reason: signal
        ? `It tests ${sentenceFragment(signal)}, which interviewers will expect you to defend clearly.`
        : `It strengthens ${question.prepQuestionTemplate.competency}, one of the clearest signals in this practice block.`,
      href: `/practice/${encodeURIComponent(question.sessionProgress.practiceSessionKey)}/${encodeURIComponent(question.prepQuestionTemplateId)}`
    };
  }

  return {
    title: "your next practice question",
    reason: "It keeps your preparation moving without turning today into a long session.",
    href: "/practice"
  };
}

function activityTime(question: {
  draftUpdatedAt: Date | null;
  lastAttemptedAt: Date | null;
}): number {
  return Math.max(
    question.draftUpdatedAt?.getTime() ?? 0,
    question.lastAttemptedAt?.getTime() ?? 0
  );
}

function firstName(value: string): string {
  return value.trim().split(/\s+/)[0] ?? "";
}

function humanizeRole(role: string): string {
  return (
    {
      backend: "backend engineering",
      frontend: "frontend engineering",
      fullstack: "full-stack engineering",
      data: "data engineering",
      "ai-ml": "AI and machine learning",
      pm: "product management"
    }[role] ?? "your target role"
  );
}

function sentenceFragment(value: string): string {
  const clean = value.trim().replace(/[.!?]+$/, "");
  return clean ? clean[0]!.toLowerCase() + clean.slice(1) : "clear technical reasoning";
}

function utcDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
