import type { PrismaService } from "../database/prisma.service";
import { dsaPhases } from "@/lib/dsa/dsa";
import { buildFrontendDsaPlan, buildFullDsaPlan } from "@/lib/roadmap/frontend-plan";
import type { FrontendDsaPlan, PlanQuestion } from "@/lib/roadmap/frontend-plan";

/**
 * Read model over the DSA question bank. The bank is seeded content rather than
 * user data, so it is identical for everyone and safe to cache per process —
 * the curation on top of it is deterministic for the same reason.
 */
export class DsaService {
  private cachedPlan: FrontendDsaPlan | null = null;
  private cachedFullPlan: FrontendDsaPlan | null = null;
  private cachedQuestions: PlanQuestion[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** The curated DSA path: pattern chapters drawn from the full bank. */
  async frontendPlan(): Promise<FrontendDsaPlan> {
    if (this.cachedPlan) return this.cachedPlan;
    const plan = buildFrontendDsaPlan(await this.questions());

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

  /** Every authored DSA question, grouped into the same familiar pattern chapters. */
  async fullPlan(): Promise<FrontendDsaPlan> {
    if (this.cachedFullPlan) return this.cachedFullPlan;
    this.cachedFullPlan = buildFullDsaPlan(await this.questions());
    return this.cachedFullPlan;
  }

  private async questions(): Promise<PlanQuestion[]> {
    if (this.cachedQuestions) return this.cachedQuestions;
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

    const authoredSlugs = new Set(
      dsaPhases().flatMap((phase) => phase.questions.map((question) => question.slug))
    );
    this.cachedQuestions = rows
      .filter((row) => authoredSlugs.has(row.slug))
      .map((row) => ({
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

    return this.cachedQuestions;
  }
}
