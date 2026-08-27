import type { PrismaService } from "../../database/prisma.service";
import { FrontendRoadmapService } from "./service";

describe("roadmap question attempt idempotency", () => {
  it("treats a repeated request as success without writing or recalculating again", async () => {
    const calls: string[] = [];
    const transaction = {
      async $executeRaw() {
        calls.push("lock");
        return 1;
      },
      userQuestionAttempt: {
        async findUnique() {
          calls.push("replay");
          return { id: "existing-attempt" };
        },
        async create() {
          calls.push("create-attempt");
          return {};
        }
      },
      userRoadmap: {
        async findUniqueOrThrow() {
          calls.push("read-roadmap-in-transaction");
          return { id: "roadmap-1" };
        }
      }
    };
    const prisma = {
      userRoadmap: {
        async findUnique() {
          return { id: "roadmap-1" };
        }
      },
      async $transaction<T>(operation: (tx: typeof transaction) => Promise<T>) {
        return operation(transaction);
      }
    } as unknown as PrismaService;

    const service = new FrontendRoadmapService(prisma);
    await expect(
      service.recordQuestionAttempt(
        "candidate-1",
        {
          idempotencyKey: "10000000-0000-4000-8000-000000000006",
          action: "complete",
          dsaQuestionSlug: "two-sum"
        },
        { includeHome: false }
      )
    ).resolves.toEqual({ recorded: true, home: null });

    expect(calls).toEqual(["lock", "replay"]);
  });
});
