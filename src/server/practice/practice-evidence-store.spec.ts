import type { PrismaService } from "../database/prisma.service";
import { aggregateCandidatePracticeEvidence } from "./practice-evidence-aggregator";
import { PracticeEvidenceStore } from "./practice-evidence-store";

const NOW = Date.UTC(2026, 7, 27, 12);

describe("PracticeEvidenceStore", () => {
  it("queries only verified, versioned attempts and reuses the immutable fingerprint revision", async () => {
    const evidence = aggregateCandidatePracticeEvidence({
      id: "88888888-8888-4888-8888-888888888888",
      revision: 3,
      generatedAt: NOW,
      sourceAttemptFingerprint: "sha256-existing",
      attempts: [
        {
          id: "attempt-1",
          questionId: "frontend-react-state",
          sourceType: "PREP",
          verificationStatus: "VERIFIED",
          title: "React state ownership",
          format: "typed",
          score: 88,
          difficulty: "medium",
          observedAt: NOW,
          questionContentVersion: 2,
          evaluatorVersion: "prep-deterministic-v1",
          skillKeys: ["react"],
          topicKeys: ["react"],
          hintsUsed: 0
        }
      ]
    })!;
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "attempt-1",
        sourceType: "PREP",
        dsaQuestionSlug: null,
        prepQuestionTemplateId: "frontend-react-state",
        language: null,
        score: 0.88,
        correctness: "strong",
        questionContentVersion: 2,
        evaluatorVersion: "prep-deterministic-v1",
        verificationStatus: "VERIFIED",
        feedback: { hintsUsed: 0 },
        createdAt: new Date(NOW),
        dsaQuestion: null,
        prepQuestionTemplate: {
          id: "frontend-react-state",
          title: "React state ownership",
          format: "typed",
          difficulty: "medium",
          competency: "react",
          chapterKey: "frontend-core",
          tags: ["core", "react"],
          whatItTests: ["state ownership"]
        }
      }
    ]);
    const findUnique = vi.fn().mockImplementation(({ where }) => {
      const fingerprint = where.ownerId_sourceAttemptFingerprint_schemaVersion
        .sourceAttemptFingerprint as string;
      return Promise.resolve({
        id: evidence.id,
        ownerId: "user:test",
        revision: evidence.revision,
        schemaVersion: evidence.schemaVersion,
        sourceAttemptFingerprint: fingerprint,
        verifiedAttemptCount: evidence.verifiedAttemptCount,
        verifiedQuestionCount: evidence.verifiedQuestionCount,
        evidence: { ...evidence, sourceAttemptFingerprint: fingerprint },
        generatedAt: new Date(evidence.generatedAt),
        createdAt: new Date(evidence.generatedAt)
      });
    });
    const prisma = {
      userQuestionAttempt: { findMany },
      candidatePracticeEvidenceVersion: { findUnique }
    } as unknown as PrismaService;

    const result = await new PracticeEvidenceStore(prisma).refresh("user:test", NOW);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: "user:test",
          verificationStatus: "VERIFIED",
          questionContentVersion: { not: null },
          evaluatorVersion: { not: null }
        })
      })
    );
    expect(result).toMatchObject({ revision: 3, verifiedAttemptCount: 1 });
  });
});
