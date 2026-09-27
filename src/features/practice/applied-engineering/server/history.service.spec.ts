import { describe, expect, it, vi } from "vitest";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/features/practice/applied-engineering/domain/reviewed-incidents";
import { AppliedEngineeringHistoryService } from "./history.service";

describe("AppliedEngineeringHistoryService", () => {
  it("lists owner-scoped blocks from frozen incident snapshots", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "block-1",
        ordinal: 1,
        isCurrent: false,
        status: "ASSESSED",
        incidentSnapshot: {
          ...APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]!.incident,
          score: {
            baselineGapTransfer: 20,
            targetRoleJob: 15,
            resumeProjectRelevance: 10,
            productionEvidenceCoverage: 15,
            realism: 8,
            novelty: 5,
            total: 73
          },
          selectionReason: "Selected from the frozen reviewed incident catalogue."
        },
        preparedAt: new Date("2026-09-08T00:00:00Z"),
        assessedAt: new Date("2026-09-08T01:00:00Z"),
        questions: [
          { id: "question-1", order: 1, status: "COMPLETED" },
          { id: "question-2", order: 2, status: "LEARNED" }
        ],
        assessment: { id: "assessment-1", status: "COMPLETED" }
      }
    ]);
    const service = new AppliedEngineeringHistoryService(
      { appliedEngineeringBlock: { findMany } } as never,
      { historyBlock: vi.fn() } as never
    );

    await expect(service.list("owner-1")).resolves.toEqual([
      expect.objectContaining({
        id: "block-1",
        incident: expect.objectContaining({
          key: APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]!.incident.key,
          title: APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]!.incident.title
        }),
        completedQuestionCount: 1,
        learnedQuestionCount: 1,
        // A started library path links its questions even when it is not current.
        questions: [
          { id: "question-1", order: 1, status: "COMPLETED" },
          { id: "question-2", order: 2, status: "LEARNED" }
        ]
      })
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "owner-1" } }));
  });
});
