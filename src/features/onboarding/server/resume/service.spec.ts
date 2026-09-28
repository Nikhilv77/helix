import { z } from "zod";
import type { AiService } from "@/server/ai/ai.service";
import type { GenerateStructuredRequest } from "@/server/ai/interfaces/system-designer-ai-provider.interface";
import { AiProviderException } from "@/server/ai/ai-provider.exception";
import { ResumeService } from "./service";
import type { ResumeDocumentEvidence } from "./document";

const evidence: ResumeDocumentEvidence = {
  confidence: 0.9,
  score: 90,
  signals: [],
  warnings: [],
  identity: {
    name: "Nikhil Verma",
    emailPresent: true,
    phonePresent: true,
    profileLinkPresent: true
  },
  sections: ["experience", "education", "skills"],
  dateRanges: 3,
  achievementLines: 5,
  quantifiedAchievements: 1,
  experienceEntries: 2,
  projectEntries: 1,
  educationEntries: 1
};

/** Captures the request and replies with whatever the model is pretending to say. */
function createAi(response: unknown): {
  ai: AiService;
  requests: GenerateStructuredRequest<unknown>[];
} {
  const requests: GenerateStructuredRequest<unknown>[] = [];
  const ai = {
    generateStructured: (request: GenerateStructuredRequest<unknown>) => {
      requests.push(request);
      const parsed = (request.schema as z.ZodType<unknown, z.ZodTypeDef, unknown>).safeParse(
        response
      );
      return parsed.success
        ? Promise.resolve(parsed.data)
        : Promise.reject(new Error(parsed.error.message));
    }
  } as unknown as AiService;

  return { ai, requests };
}

const completeResponse = {
  documentType: "resume",
  isLikelyResume: true,
  confidence: 0.95,
  rejectionReason: "",
  candidateIdentitySupported: true,
  chronologyCoherent: true,
  personalCareerEvidence: true,
  evidenceCounts: {
    experienceEntries: 2,
    projectEntries: 1,
    educationEntries: 1,
    quantifiedAchievements: 1
  },
  fullName: "Nikhil Verma",
  headline: "Software engineer",
  summary: "Builds reliable systems.",
  skills: ["TypeScript"],
  focusAreas: ["Ownership"],
  stories: [],
  experience: [],
  education: [],
  projects: [],
  achievements: [],
  practiceQuestions: [],
  roadmap: [],
  warnings: []
};

describe("ResumeService.analyze", () => {
  const input = {
    text: "Nikhil Verma\nEXPERIENCE\nSoftware Engineer, Acme Systems",
    targetRole: "fullstack" as const,
    level: "3-5" as const,
    evidence
  };

  it("splits the budget across Gemini attempts when there is no fallback", async () => {
    const { ai, requests } = createAi(completeResponse);

    await new ResumeService(ai).analyze({ ...input, budgetMs: 24_000, maxAttempts: 2 });

    expect(requests[0]).toMatchObject({
      operation: "resume_extract",
      timeoutMs: 12_000,
      maxAttempts: 2
    });
  });

  it("hedges a stalled Gemini call and falls back with the time that is left", async () => {
    let now = 0;
    const timeout = new AiProviderException({
      code: "AI_TIMEOUT",
      message: "timed out",
      provider: "gemini",
      operation: "resume_extract",
      retryable: true
    });
    const primary = {
      generateStructured: vi.fn(async () => {
        now += 25_000;
        throw timeout;
      })
    };
    const { ai: fallback, requests: fallbackRequests } = createAi(completeResponse);

    const analysis = await new ResumeService(
      primary as never,
      { ai: fallback, modelClass: "reasoning" },
      () => now
    ).analyze({
      ...input,
      budgetMs: 45_000
    });

    expect(analysis).toBeTruthy();
    expect(primary.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 25_000, maxAttempts: 1, hedgeAfterMs: 12_000 })
    );
    expect(fallbackRequests[0]).toMatchObject({
      operation: "resume_extract-fallback",
      modelClass: "reasoning",
      timeoutMs: 20_000,
      maxAttempts: 1
    });
  });

  it("does not fall back from a non-retryable failure or without time left", async () => {
    const hardFailure = new AiProviderException({
      code: "AI_PROVIDER_ERROR",
      message: "bad request",
      provider: "gemini",
      operation: "resume_extract",
      retryable: false
    });
    const primary = { generateStructured: vi.fn().mockRejectedValue(hardFailure) };
    const { ai: fallback, requests } = createAi(completeResponse);

    await expect(
      new ResumeService(primary as never, { ai: fallback, modelClass: "reasoning" }).analyze({
        ...input,
        budgetMs: 45_000
      })
    ).rejects.toBe(hardFailure);
    expect(requests).toHaveLength(0);
  });

  it("instructs analysis to infer the role when onboarding supplies no selection", async () => {
    const { ai, requests } = createAi(completeResponse);

    await new ResumeService(ai).analyze({
      text: input.text,
      level: input.level,
      evidence: input.evidence
    });

    expect(requests[0]?.prompt).toContain("No target role was selected");
    expect(requests[0]?.prompt).toContain("Infer the candidate's primary interview role");
  });

  it("trims overlong fields instead of failing the whole upload", async () => {
    const { ai } = createAi({
      ...completeResponse,
      headline: "x".repeat(400),
      summary: "y".repeat(4_000)
    });

    const analysis = await new ResumeService(ai).analyze(input);

    expect(analysis.headline).toHaveLength(140);
    expect(analysis.summary).toHaveLength(1200);
  });

  it("caps oversized lists rather than rejecting the response", async () => {
    const { ai } = createAi({
      ...completeResponse,
      skills: Array.from({ length: 40 }, (_, index) => `skill-${index}`),
      practiceQuestions: Array.from({ length: 12 }, (_, index) => ({
        competency: "Ownership",
        prompt: `Question ${index}`,
        evidenceAnchor: "Acme Systems"
      }))
    });

    const analysis = await new ResumeService(ai).analyze(input);

    expect(analysis.skills).toHaveLength(16);
    expect(analysis.practiceQuestions).toHaveLength(6);
  });

  it("normalises a confidence returned as a percentage", async () => {
    const { ai } = createAi({ ...completeResponse, confidence: 95 });

    await expect(new ResumeService(ai).analyze(input)).resolves.toMatchObject({ confidence: 0.95 });
  });

  it("falls back to safe values when individual fields are the wrong type", async () => {
    const { ai } = createAi({
      ...completeResponse,
      rejectionReason: null,
      skills: "TypeScript, React",
      warnings: null
    });

    const analysis = await new ResumeService(ai).analyze(input);

    expect(analysis.rejectionReason).toBe("");
    expect(analysis.skills).toEqual([]);
    expect(analysis.warnings).toEqual([]);
  });

  it("reads a visual PDF with the fallback model when the fast model is overloaded", async () => {
    let now = 0;
    const overloaded = new AiProviderException({
      code: "AI_PROVIDER_ERROR",
      message: "AI provider request failed",
      provider: "gemini",
      operation: "resume_visual_text_extract",
      retryable: true
    });
    const primary = {
      generateStructured: vi.fn(async () => {
        now += 10_500;
        throw overloaded;
      })
    } as unknown as AiService;
    const fallback = {
      generateStructured: vi.fn(async () => ({ readable: true, text: "Nikhil Verma\nEngineer" }))
    } as unknown as AiService;
    const service = new ResumeService(
      primary,
      { ai: fallback, modelClass: "reasoning" },
      () => now
    );

    const text = await service.readVisualPdf({
      buffer: Buffer.from("%PDF"),
      pageCount: 1,
      timeoutMs: 24_000
    });

    expect(text).toBe("Nikhil Verma\nEngineer");
    const [primaryRequest] = vi.mocked(primary.generateStructured).mock.calls[0]!;
    const [fallbackRequest] = vi.mocked(fallback.generateStructured).mock.calls[0]!;
    expect(primaryRequest).toMatchObject({ modelClass: "fast", timeoutMs: 13_200, maxAttempts: 1 });
    expect(fallbackRequest).toMatchObject({ modelClass: "reasoning", timeoutMs: 13_500 });
  });

  it("does not start a visual fallback without enough time to read the PDF", async () => {
    let now = 0;
    const primary = {
      generateStructured: vi.fn(async () => {
        now += 20_000;
        throw new Error("slow failure");
      })
    } as unknown as AiService;
    const fallback = { generateStructured: vi.fn() } as unknown as AiService;
    const service = new ResumeService(
      primary,
      { ai: fallback, modelClass: "reasoning" },
      () => now
    );

    await expect(
      service.readVisualPdf({ buffer: Buffer.from("%PDF"), pageCount: 1, timeoutMs: 24_000 })
    ).rejects.toThrow("slow failure");
    expect(fallback.generateStructured).not.toHaveBeenCalled();
  });

  it("starts the fallback read after 6 s while a saturated fast model is still silent", async () => {
    vi.useFakeTimers();
    try {
      const primary = {
        generateStructured: vi.fn(() => new Promise(() => undefined))
      } as unknown as AiService;
      const fallback = {
        generateStructured: vi.fn(async () => ({ readable: true, text: "Resume text" }))
      } as unknown as AiService;
      const service = new ResumeService(primary, { ai: fallback, modelClass: "reasoning" });

      const read = service.readVisualPdf({
        buffer: Buffer.from("%PDF"),
        pageCount: 1,
        timeoutMs: 24_000
      });
      await vi.advanceTimersByTimeAsync(5_999);
      expect(fallback.generateStructured).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await expect(read).resolves.toBe("Resume text");
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips a fast model that just failed for the rest of the upload and the next two minutes", async () => {
    let now = 0;
    const overloaded = new AiProviderException({
      code: "AI_PROVIDER_ERROR",
      message: "overloaded",
      provider: "gemini",
      operation: "resume_visual_text_extract",
      retryable: true
    });
    const primary = {
      generateStructured: vi.fn(async () => {
        throw overloaded;
      })
    } as unknown as AiService;
    const fallback = {
      generateStructured: vi.fn(async () => ({ readable: true, text: "Resume text" }))
    } as unknown as AiService;
    const service = new ResumeService(
      primary,
      { ai: fallback, modelClass: "reasoning" },
      () => now
    );

    await service.readVisualPdf({ buffer: Buffer.from("%PDF"), pageCount: 1, timeoutMs: 24_000 });
    await service.readVisualPdf({ buffer: Buffer.from("%PDF"), pageCount: 1, timeoutMs: 24_000 });
    expect(primary.generateStructured).toHaveBeenCalledTimes(1);

    now += 2 * 60_000 + 1;
    await service.readVisualPdf({ buffer: Buffer.from("%PDF"), pageCount: 1, timeoutMs: 24_000 });
    expect(primary.generateStructured).toHaveBeenCalledTimes(2);
  });

  it("uses a third model when the fast and reasoning models are both overloaded", async () => {
    const overloaded = () =>
      new AiProviderException({
        code: "AI_PROVIDER_ERROR",
        message: "overloaded",
        provider: "gemini",
        operation: "resume_visual_text_extract",
        retryable: true
      });
    const failing = () =>
      ({
        generateStructured: vi.fn(async () => {
          throw overloaded();
        })
      }) as unknown as AiService;
    const fast = failing();
    const reasoning = failing();
    const backup = {
      generateStructured: vi.fn(async () => ({ readable: true, text: "Resume text" }))
    } as unknown as AiService;
    let now = 0;
    const service = new ResumeService(
      fast,
      [
        { ai: reasoning, modelClass: "reasoning" },
        { ai: backup, modelClass: "reasoning" }
      ],
      () => now
    );

    await expect(
      service.readVisualPdf({ buffer: Buffer.from("%PDF"), pageCount: 1, timeoutMs: 24_000 })
    ).resolves.toBe("Resume text");

    // Both saturated models are skipped next time; the backup goes straight in.
    now += 1_000;
    await service.readVisualPdf({ buffer: Buffer.from("%PDF"), pageCount: 1, timeoutMs: 24_000 });
    expect(fast.generateStructured).toHaveBeenCalledTimes(1);
    expect(reasoning.generateStructured).toHaveBeenCalledTimes(1);
    expect(backup.generateStructured).toHaveBeenCalledTimes(2);
  });
});
