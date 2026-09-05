import {
  RoadmapProgressStatus,
  RoadmapQuestionAttemptStatus,
  RoadmapQuestionSourceType
} from "@prisma/client";

import type { PrismaService } from "../../database/prisma.service";
import { FrontendRoadmapService } from "./service";

function serviceFixture(
  options: { roadmap?: boolean; progress?: boolean; bestScore?: number; replay?: boolean } = {}
) {
  const writes: Array<{ model: string; data: Record<string, unknown> }> = [];
  const roadmapExists = options.roadmap ?? true;
  const progressExists = options.progress ?? true;

  const transaction = {
    $executeRaw: async () => 1,
    userQuestionProgress: {
      async findFirst() {
        if (!progressExists) return null;
        return {
          id: "progress-1",
          sourceType: RoadmapQuestionSourceType.DSA,
          dsaQuestionSlug: "two-sum",
          prepQuestionTemplateId: null,
          status: RoadmapProgressStatus.ACTIVE,
          bestScore: options.bestScore ?? null,
          dsaQuestion: { contentVersion: 3 }
        };
      },
      async update({ data }: { data: Record<string, unknown> }) {
        writes.push({ model: "progress", data });
        return {};
      },
      async aggregate() {
        return { _max: { order: 140 } };
      },
      async create({ data }: { data: Record<string, unknown> }) {
        writes.push({ model: "enrollment", data });
        return {
          id: "progress-enrolled",
          sourceType: RoadmapQuestionSourceType.DSA,
          dsaQuestionSlug: "two-sum",
          prepQuestionTemplateId: null,
          status: RoadmapProgressStatus.ACTIVE,
          bestScore: null,
          dsaQuestion: { contentVersion: 3 }
        };
      }
    },
    dsaQuestion: {
      async findUnique() {
        return {
          slug: "two-sum",
          title: "Two Sum",
          difficulty: "easy",
          expectedTimeMinutes: 10,
          primaryPattern: "arrays-hashing"
        };
      }
    },
    userSessionProgress: {
      async findFirst() {
        return { id: "dsa-session" };
      }
    },
    userChapterProgress: {
      async findFirst() {
        return { id: "arrays-chapter" };
      }
    },
    userQuestionAttempt: {
      async findUnique() {
        return options.replay ? { id: "existing-attempt" } : null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        writes.push({ model: "attempt", data });
        return {};
      }
    }
  };

  const prisma = {
    userRoadmap: {
      async findUnique() {
        return roadmapExists ? { id: "roadmap-1" } : null;
      }
    },
    async $transaction<T>(operation: (tx: typeof transaction) => Promise<T>) {
      return operation(transaction);
    }
  } as unknown as PrismaService;

  return { service: new FrontendRoadmapService(prisma), writes };
}

describe("code-run helper evidence", () => {
  it("stores language and score separately from a manual completion", async () => {
    const { service, writes } = serviceFixture();

    await expect(
      service.recordCodeRunEvidence("helper-1", {
        idempotencyKey: "10000000-0000-4000-8000-000000000001",
        dsaQuestionSlug: "two-sum",
        language: "python",
        sourceCode: "def twoSum(nums, target):\n    return []",
        score: 0.8,
        accepted: false,
        testsPassed: 4,
        testCount: 5
      })
    ).resolves.toBe(true);

    expect(writes[0]).toMatchObject({
      model: "attempt",
      data: {
        ownerId: "helper-1",
        dsaQuestionSlug: "two-sum",
        status: RoadmapQuestionAttemptStatus.SUBMITTED,
        language: "python",
        answer: "def twoSum(nums, target):\n    return []",
        score: 0.8,
        correctness: "not-accepted",
        questionContentVersion: 3,
        evaluatorVersion: "dsa-code-run-v1",
        verificationStatus: "VERIFIED"
      }
    });
    expect(writes[1]).toMatchObject({
      model: "progress",
      data: {
        status: RoadmapProgressStatus.IN_PROGRESS,
        attemptCount: { increment: 1 },
        bestScore: 0.8
      }
    });
  });

  it("never lowers the question's existing best score", async () => {
    const { service, writes } = serviceFixture({ bestScore: 0.95 });

    await service.recordCodeRunEvidence("helper-1", {
      idempotencyKey: "10000000-0000-4000-8000-000000000002",
      dsaQuestionSlug: "two-sum",
      language: "java",
      score: 0.4,
      accepted: false,
      testsPassed: 2,
      testCount: 5
    });

    expect(writes[1]).toMatchObject({ model: "progress", data: { bestScore: 0.95 } });
  });

  it("retains only bounded visible test facts for a later code-review assessment", async () => {
    const { service, writes } = serviceFixture();
    const oversized = "x".repeat(620);

    await service.recordCodeRunEvidence("helper-1", {
      idempotencyKey: "10000000-0000-4000-8000-000000000006",
      dsaQuestionSlug: "two-sum",
      language: "javascript",
      sourceCode: "function twoSum() { return []; }",
      score: 0.4,
      accepted: false,
      testsPassed: 1,
      testCount: 4,
      visibleTestEvidence: [
        {
          input: oversized,
          expectedOutput: "[0, 1]",
          actualOutput: "[]",
          error: null,
          passed: false
        },
        {
          input: "[2, 7]",
          expectedOutput: "[0, 1]",
          actualOutput: "[0, 1]",
          error: null,
          passed: true
        },
        {
          input: "[3, 3]",
          expectedOutput: "[0, 1]",
          actualOutput: "[0, 1]",
          error: null,
          passed: true
        },
        {
          input: "fourth visible example",
          expectedOutput: "[0, 1]",
          actualOutput: "[0, 1]",
          error: null,
          passed: true
        }
      ]
    });

    const attempt = writes.find((write) => write.model === "attempt");
    const feedback = (attempt?.data.feedback ?? {}) as {
      visibleTestEvidence?: Array<{ input: string; expectedOutput: string }>;
    };
    expect(feedback.visibleTestEvidence).toHaveLength(3);
    expect(feedback.visibleTestEvidence?.[0]?.input).toHaveLength(500);
    expect(feedback.visibleTestEvidence?.flatMap((test) => [test.input])).not.toContain(
      "fourth visible example"
    );
  });

  it("enrolls an Explore-all question on demand before recording its evidence", async () => {
    const { service, writes } = serviceFixture({ progress: false });

    await expect(
      service.recordCodeRunEvidence("helper-1", {
        idempotencyKey: "10000000-0000-4000-8000-000000000003",
        dsaQuestionSlug: "two-sum",
        language: "cpp",
        score: 1,
        accepted: true,
        testsPassed: 5,
        testCount: 5
      })
    ).resolves.toBe(true);
    expect(writes[0]).toMatchObject({
      model: "enrollment",
      data: {
        dsaQuestionSlug: "two-sum",
        sessionProgressId: "dsa-session",
        chapterProgressId: "arrays-chapter",
        order: 141
      }
    });
    expect(writes[1]).toMatchObject({ model: "attempt" });
    expect(writes[2]).toMatchObject({ model: "progress" });
  });

  it("returns quickly when the user has no compatible roadmap", async () => {
    const { service, writes } = serviceFixture({ roadmap: false });

    await expect(
      service.recordCodeRunEvidence("helper-1", {
        idempotencyKey: "10000000-0000-4000-8000-000000000004",
        dsaQuestionSlug: "two-sum",
        language: "javascript",
        score: 1,
        accepted: true,
        testsPassed: 5,
        testCount: 5
      })
    ).resolves.toBe(false);
    expect(writes).toEqual([]);
  });

  it("replays a repeated code-run evidence request without double-counting", async () => {
    const { service, writes } = serviceFixture({ replay: true });

    await expect(
      service.recordCodeRunEvidence("helper-1", {
        idempotencyKey: "10000000-0000-4000-8000-000000000005",
        dsaQuestionSlug: "two-sum",
        language: "python",
        score: 1,
        accepted: true,
        testsPassed: 5,
        testCount: 5
      })
    ).resolves.toBe(true);

    expect(writes).toEqual([]);
  });
});
