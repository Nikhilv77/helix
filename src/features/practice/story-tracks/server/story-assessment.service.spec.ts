import { describe, expect, it, vi } from "vitest";
import { storyDiscipline } from "@/features/practice/story-tracks/domain/story-disciplines";
import { StoryAssessmentService } from "./story-assessment.service";

const PATH = storyDiscipline("frontend").paths("core-technical")[0]!;
const SCOPE = {
  discipline: "frontend" as const,
  track: "core-technical" as const,
  pathKey: PATH.key
};

type Row = {
  id: string;
  ownerId: string;
  discipline: string;
  track: string;
  pathKey: string;
  status: "IN_PROGRESS" | "FINALIZING" | "COMPLETED";
  snapshot: unknown;
  responses: unknown;
  report: unknown;
  updatedAt: Date;
};

function harness(questionStatus: "ACTIVE" | "COMPLETED" = "COMPLETED", allowEarlyStart = false) {
  const rows: Row[] = [];
  const sessions = new Map<string, { ownerId: string; state: unknown }>();
  const matches = (row: Row, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (key === "OR") {
        return (value as Array<Record<string, unknown>>).some((branch) => matches(row, branch));
      }
      if (key === "ownerId_discipline_track_pathKey") {
        return Object.entries(value as Record<string, string>).every(
          ([k, v]) => row[k as keyof Row] === v
        );
      }
      if (key === "updatedAt") return row.updatedAt < (value as { lt: Date }).lt;
      return row[key as keyof Row] === value;
    });
  const prisma = {
    storyTrackAssessment: {
      findUnique: vi.fn(async ({ where }) => rows.find((row) => matches(row, where)) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }) => rows.find((row) => matches(row, where))!),
      findFirst: vi.fn(async ({ where }) => rows.find((row) => matches(row, where)) ?? null),
      create: vi.fn(async ({ data }) => {
        const row: Row = {
          id: `00000000-0000-4000-8000-00000000000${rows.length + 1}`,
          status: "IN_PROGRESS",
          responses: {},
          report: null,
          updatedAt: new Date(),
          ...data
        };
        rows.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const hits = rows.filter((row) => matches(row, where));
        hits.forEach((row) => Object.assign(row, data, { updatedAt: new Date() }));
        return { count: hits.length };
      })
    },
    aiMlPracticeQuestion: {
      findMany: vi.fn(async () =>
        PATH.questions.map((question, index) => ({
          questionKey: question.id,
          status: questionStatus,
          attempt: {
            correct: null,
            evaluationSnapshot: { feedback: { score: index === 2 ? 3 : 8 } }
          }
        }))
      )
    },
    candidateProfile: {
      findUnique: vi.fn(async () => ({ targetRole: "frontend", level: "3-5", context: null }))
    },
    interviewSession: {
      findUnique: vi.fn(async ({ where }) => sessions.get(where.id) ?? null)
    }
  };
  const start = vi.fn(async (setup, ownerId, _now, plan, sessionId) => {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        ownerId,
        state: { id: sessionId, phase: "questioning", setup, plan, turns: [] }
      });
    }
    return { state: { id: sessionId }, created: true };
  });
  const generateStructured = vi.fn(async () => ({
    schemaVersion: 1,
    score: 7,
    result: "Mostly right.",
    mechanism: "The strong answer.",
    didWell: "You named the cause.",
    missingOrIncorrect: "You skipped verification.",
    productionConsequence: "Users would see stale data.",
    transferExample: "Same idea elsewhere.",
    interviewerFollowUp: "How would you test it?",
    missedEdgeCases: []
  }));
  const service = new StoryAssessmentService(
    prisma as never,
    { generateStructured } as never,
    { start } as never,
    { allowEarlyStart }
  );
  const finish = (sessionId: string, answers: Array<[number, string]>) => {
    const session = sessions.get(sessionId)!;
    const state = session.state as Record<string, unknown>;
    session.state = {
      ...state,
      phase: "done",
      turns: answers.map(([questionIndex, text]) => ({ speaker: "user", questionIndex, text }))
    };
  };
  return { service, rows, sessions, start, generateStructured, finish };
}

describe("StoryAssessmentService", () => {
  it("stays locked until every question in the path is finished", async () => {
    const { service } = harness("ACTIVE");

    await expect(service.summary("owner-1", SCOPE)).resolves.toMatchObject({
      status: "LOCKED",
      remaining: PATH.questions.length
    });
    await expect(service.startOrResume("owner-1", SCOPE)).rejects.toMatchObject({
      code: "STORY_ASSESSMENT_LOCKED"
    });
  });

  it("allows an early start only when the development flag is on", async () => {
    const { service } = harness("ACTIVE", true);
    await expect(service.startOrResume("owner-1", SCOPE)).resolves.toHaveProperty("sessionId");
  });

  it("starts the shared assessment room once, on the frozen prompts", async () => {
    const { service, rows, start } = harness();

    const first = await service.startOrResume("owner-1", SCOPE);
    const second = await service.startOrResume("owner-1", SCOPE);

    expect(second.sessionId).toBe(first.sessionId);
    expect(rows).toHaveLength(1);
    const [setup, ownerId, , plan, sessionId] = start.mock.calls[0]!;
    expect(ownerId).toBe("owner-1");
    expect(sessionId).toBe(first.sessionId);
    expect(setup.storyPracticeAssessment).toMatchObject({
      practice: "story-track",
      assessmentId: first.sessionId
    });
    expect(plan.map((question: { kind: string }) => question.kind)).toEqual([
      "mcq",
      "conversation",
      "conversation",
      "mcq"
    ]);
    // The weakest open question is the one to explain.
    expect(plan[1].text).toContain(PATH.questions[2]!.prompt);
    // Reference answers stay in the server-only interviewer guide.
    expect(plan[1].storyPracticeInterviewerGuide.expectedAnswer).toContain(
      PATH.questions[2]!.answer.concise
    );
  });

  it("grades the finished room once and completes the assessment", async () => {
    const { service, generateStructured, finish, start } = harness();
    const { sessionId } = await service.startOrResume("owner-1", SCOPE);
    const plan = start.mock.calls[0]![3] as Array<{ options?: string[]; answerIndex?: number }>;
    const wrongTrap = plan[3]!.options![(plan[3]!.answerIndex! + 1) % plan[3]!.options!.length]!;
    finish(sessionId, [
      [0, plan[0]!.options![plan[0]!.answerIndex!]!],
      [1, "A resize listener keeps the closed panel alive; remove it on unmount."],
      [2, "The event loop never reaches the next task, so rendering stalls."],
      [3, wrongTrap]
    ]);

    const [report, repeated] = await Promise.all([
      service.finalizeInterviewOwned("owner-1", sessionId),
      service.finalizeInterviewOwned("owner-1", sessionId)
    ]);

    // Only the two written answers need the model; choices are matched directly.
    expect(generateStructured).toHaveBeenCalledTimes(2);
    expect([report, repeated].filter(Boolean)).toHaveLength(1);
    const summary = await service.summary("owner-1", SCOPE);
    expect(summary).toMatchObject({ status: "COMPLETED", report: { overallScore: 60 } });
    expect(
      summary.status === "COMPLETED" && summary.report.prompts.map((prompt) => prompt.score)
    ).toEqual([100, 70, 70, 0]);
  });

  it("does not grade a room that is still in progress or belongs to someone else", async () => {
    const { service, generateStructured, finish } = harness();
    const { sessionId } = await service.startOrResume("owner-1", SCOPE);

    await expect(service.finalizeInterviewOwned("owner-1", sessionId)).resolves.toBeNull();
    finish(sessionId, [[0, "Answer."]]);
    await expect(service.finalizeInterviewOwned("owner-2", sessionId)).resolves.toBeNull();
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("releases the claim when grading fails so a later visit retries", async () => {
    const { service, rows, generateStructured, finish } = harness();
    const { sessionId } = await service.startOrResume("owner-1", SCOPE);
    finish(sessionId, [[1, "My answer."]]);
    generateStructured.mockRejectedValueOnce(new Error("provider down"));

    await expect(service.finalizeInterviewOwned("owner-1", sessionId)).rejects.toThrow(
      "provider down"
    );
    expect(rows[0]).toMatchObject({ status: "IN_PROGRESS", responses: { explain: "My answer." } });

    await service.finalizeInterviewOwned("owner-1", sessionId);
    expect(rows[0]!.status).toBe("COMPLETED");
  });
});
