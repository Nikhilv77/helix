import { z } from "zod";
import type { AiService } from "../../ai/ai.service";
import type { GenerateStructuredRequest } from "../../ai/interfaces/system-designer-ai-provider.interface";
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

  it("passes the per-call budget through to the provider", async () => {
    const { ai, requests } = createAi(completeResponse);

    await new ResumeService(ai).analyze({ ...input, timeoutMs: 12_000, maxAttempts: 2 });

    expect(requests[0]).toMatchObject({
      operation: "resume_extract",
      timeoutMs: 12_000,
      maxAttempts: 2
    });
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
});
