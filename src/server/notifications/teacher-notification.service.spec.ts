import type { PrismaService } from "../database/prisma.service";
import type { NotificationDispatcher } from "./notification-dispatcher";
import { NotificationKind } from "./notification.service";
import { TeacherNotificationService } from "./teacher-notification.service";

describe("teacher notifications", () => {
  it("forms a personalized, idempotent onboarding welcome and email", async () => {
    const dispatch = jest.fn().mockResolvedValue({ recorded: true, emailed: true });
    const service = new TeacherNotificationService(
      {} as PrismaService,
      { dispatch } as unknown as NotificationDispatcher
    );

    await service.welcome({
      ownerId: "candidate-1",
      teacherId: "pooja",
      candidateName: "Ishan Rao",
      targetRole: "ai-ml",
      focusAreas: ["RAG evaluation"]
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "candidate-1",
        kind: NotificationKind.TEACHER_WELCOME,
        href: "/practice",
        subjectId: "onboarding-v1",
        title: expect.stringContaining("Pooja"),
        email: expect.objectContaining({
          subject: "Pooja from Trailgrad — your practice path is ready",
          body: expect.stringContaining("Hi Ishan,")
        })
      })
    );
    expect(dispatch.mock.calls[0]![0].email.body).toContain("RAG evaluation");
    expect(dispatch.mock.calls[0]![0].email.fromName).toBe("Pooja from Trailgrad");
    expect(dispatch.mock.calls[0]![0].email.html).toContain("cid:trailgrad-logo");
    expect(dispatch.mock.calls[0]![0].email.html).toContain("Start your first question");
  });

  it("normalizes an all-caps resume name in the welcome template", async () => {
    const dispatch = jest.fn().mockResolvedValue({ recorded: true, emailed: true });
    const service = new TeacherNotificationService(
      {} as PrismaService,
      { dispatch } as unknown as NotificationDispatcher,
      "https://app.trailgrad.com"
    );

    await service.welcome({
      ownerId: "candidate-1",
      teacherId: "ethan",
      candidateName: "VIKRAM VERMA",
      targetRole: "frontend",
      focusAreas: ["Technical depth"]
    });

    const email = dispatch.mock.calls[0]![0].email;
    expect(email.body).toContain("Hi Vikram,");
    expect(email.html).toContain("Hi Vikram,");
    expect(email.html).toContain("https://app.trailgrad.com/practice");
  });

  it("sends one recommendation plus a second nudge only for unfinished work", async () => {
    const dispatch = jest.fn().mockResolvedValue({ recorded: true, emailed: false });
    const prisma = {
      candidateProfile: {
        findMany: jest.fn().mockResolvedValue([{ ownerId: "candidate-1", teacherId: "maya" }])
      },
      userQuestionProgress: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "unfinished",
            order: 1,
            attemptCount: 1,
            lastAttemptedAt: new Date("2026-08-27T12:00:00.000Z"),
            draftUpdatedAt: new Date("2026-08-27T12:00:00.000Z"),
            dsaQuestionSlug: "contains-duplicate",
            prepQuestionTemplateId: null,
            sessionProgress: { practiceSessionKey: "dsa" },
            dsaQuestion: {
              title: "Contains Duplicate",
              primaryPattern: "Hashing",
              promptSummary: "Find a duplicate."
            },
            prepQuestionTemplate: null
          },
          {
            id: "next",
            order: 2,
            attemptCount: 0,
            lastAttemptedAt: null,
            draftUpdatedAt: null,
            dsaQuestionSlug: null,
            prepQuestionTemplateId: "rate-limiter",
            sessionProgress: { practiceSessionKey: "system-design" },
            dsaQuestion: null,
            prepQuestionTemplate: {
              title: "Design a Rate Limiter",
              competency: "System design",
              whatItTests: ["Scalability trade-offs"]
            }
          }
        ])
      }
    } as unknown as PrismaService;
    const service = new TeacherNotificationService(prisma, {
      dispatch
    } as unknown as NotificationDispatcher);

    await expect(service.dispatchDaily(new Date("2026-08-28T04:00:00.000Z"))).resolves.toEqual({
      candidates: 1,
      recorded: 2,
      failed: 0
    });

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        kind: NotificationKind.TEACHER_RECOMMENDATION,
        subjectId: "2026-08-28:primary",
        href: "/practice/system-design/rate-limiter"
      })
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: NotificationKind.TEACHER_REMINDER,
        subjectId: "2026-08-28:unfinished:unfinished",
        href: "/dsa-questions/contains-duplicate"
      })
    );
  });

  it("sends only one generic recommendation when no roadmap question is available", async () => {
    const dispatch = jest.fn().mockResolvedValue({ recorded: true, emailed: false });
    const prisma = {
      candidateProfile: {
        findMany: jest.fn().mockResolvedValue([{ ownerId: "candidate-1", teacherId: "claire" }])
      },
      userQuestionProgress: { findMany: jest.fn().mockResolvedValue([]) }
    } as unknown as PrismaService;
    const service = new TeacherNotificationService(prisma, {
      dispatch
    } as unknown as NotificationDispatcher);

    await expect(service.dispatchDaily(new Date("2026-08-28T04:00:00.000Z"))).resolves.toEqual({
      candidates: 1,
      recorded: 1,
      failed: 0
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Claire"), href: "/practice" })
    );
  });

  it("occasionally replaces the daily question prompt with a warm teacher note", async () => {
    const dispatch = jest.fn().mockResolvedValue({ recorded: true, emailed: false });
    const prisma = {
      candidateProfile: {
        findMany: jest.fn().mockResolvedValue([{ ownerId: "candidate-1", teacherId: "claire" }])
      },
      userQuestionProgress: { findMany: jest.fn().mockResolvedValue([]) }
    } as unknown as PrismaService;
    const service = new TeacherNotificationService(prisma, {
      dispatch
    } as unknown as NotificationDispatcher);

    await service.dispatchDaily(new Date("2026-08-27T04:00:00.000Z"));
    await service.dispatchDaily(new Date("2026-08-28T04:00:00.000Z"));

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        kind: NotificationKind.TEACHER_ENCOURAGEMENT,
        title: expect.stringContaining("Claire"),
        subjectId: "2026-08-27:encouragement"
      })
    );
    expect(dispatch.mock.calls[0]![0]).not.toHaveProperty("href");
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: NotificationKind.TEACHER_RECOMMENDATION,
        href: "/practice",
        subjectId: "2026-08-28:primary"
      })
    );
  });
});
