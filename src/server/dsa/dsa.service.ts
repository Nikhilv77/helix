import type { PrismaService } from "../database/prisma.service";
import { buildFrontendDsaPlan } from "@/lib/frontend-plan";
import type { FrontendDsaPlan, PlanQuestion } from "@/lib/frontend-plan";

/**
 * Read model over the DSA question bank. The bank is seeded content rather than
 * user data, so it is identical for everyone and safe to cache per process —
 * the curation on top of it is deterministic for the same reason.
 */
export class DsaService {
  private cachedPlan: FrontendDsaPlan | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** The curated Frontend DSA path: pattern chapters drawn from the full bank. */
  async frontendPlan(): Promise<FrontendDsaPlan> {
    if (this.cachedPlan) return this.cachedPlan;

    const rows = await this.prisma.dsaQuestion.findMany({
      select: {
        slug: true,
        title: true,
        difficulty: true,
        primaryPattern: true,
        expectedTimeMinutes: true,
        phaseSlug: true,
        recommendedOrder: true,
        phase: { select: { phaseNumber: true } }
      },
      orderBy: [{ phase: { phaseNumber: "asc" } }, { recommendedOrder: "asc" }]
    });

    const questions: PlanQuestion[] = rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      // The column is a plain string; anything unexpected is treated as medium
      // rather than crashing the whole plan over one bad row.
      difficulty:
        row.difficulty === "easy" || row.difficulty === "hard" ? row.difficulty : "medium",
      primaryPattern: row.primaryPattern,
      expectedTimeMinutes: row.expectedTimeMinutes,
      phaseSlug: row.phaseSlug,
      phaseNumber: row.phase.phaseNumber,
      recommendedOrder: row.recommendedOrder
    }));

    const plan = buildFrontendDsaPlan(questions);

    // Maya's brief comes from the next question's own coaching text. Nothing
    // here is generated: `commonMistakes` and `interviewSignals` are columns
    // written when the bank was authored.
    const next = plan.chapters[0]?.questions[0] ?? null;
    if (next) {
      const detail = await this.prisma.dsaQuestion.findUnique({
        where: { slug: next.slug },
        select: { title: true, commonMistakes: true, interviewSignals: true }
      });
      const chapter = plan.chapters[0];
      if (detail && chapter) {
        plan.coach = {
          chapterTitle: chapter.title,
          chapterWhy: chapter.whyItMatters,
          questionTitle: detail.title,
          questionSlug: next.slug,
          watchOut: detail.commonMistakes[0] ?? null,
          signal: detail.interviewSignals[0] ?? null
        };
      }
    }

    this.cachedPlan = plan;
    return this.cachedPlan;
  }
}
