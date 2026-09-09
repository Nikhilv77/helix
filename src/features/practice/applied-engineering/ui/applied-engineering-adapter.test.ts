import { describe, expect, it } from "vitest";
import type { AppliedEngineeringPublicBlock } from "@/features/practice/applied-engineering/server/practice.service";
import { appliedEngineeringBlockView } from "./applied-engineering-adapter";

describe("Applied Engineering presentation adapter", () => {
  it("maps domain-specific feedback and score dimensions without changing the domain model", () => {
    const view = appliedEngineeringBlockView({
      incident: { productionSignalKeys: ["evidence-selection"] },
      selection: { emphasizedSignalKeys: ["evidence-selection"] },
      questions: [
        {
          question: { incidentKey: "incident", productionSignalKeys: ["evidence-selection"] },
          latestAttempt: {
            feedback: {
              schemaVersion: 1,
              score: 8,
              result: "Good diagnosis",
              evidenceUse: "Used the latency evidence.",
              rootCauseReasoning: "Connected retries to saturation.",
              repairQuality: "Bounded retry count.",
              verificationQuality: "Added a load test.",
              productionConsequence: "Prevents overload.",
              saferDelivery: "Canary with rollback.",
              interviewerFollowUp: "How would you tune it?",
              missedEdgeCases: []
            }
          }
        }
      ],
      assessment: {
        assessment: null,
        transcript: null,
        report: {
          scores: {
            diagnosisEvidence: 91,
            implementationCorrectness: 82,
            testingVerification: 73,
            productionJudgment: 64,
            ownershipDelivery: 55
          },
          nextIncident: {
            selectedIncident: {
              incidentKey: "next-incident",
              incidentVersion: 1,
              emphasizedSignalKeys: ["rollout-safety"]
            }
          }
        }
      }
    } as unknown as AppliedEngineeringPublicBlock);

    expect(view.questions[0]?.latestAttempt?.feedback).toMatchObject({
      didWell: "Used the latency evidence.",
      mechanism: "Connected retries to saturation.",
      transferExample: "Canary with rollback."
    });
    expect(view.assessment?.report?.scores).toEqual({
      technicalAccuracy: 91,
      mechanismReasoning: 82,
      diagnosisEvidence: 73,
      debuggingImplementation: 64,
      communicationProduction: 55
    });
    expect(view.assessment?.report?.nextStory.selectedStory.emphasizedConceptKeys).toEqual([
      "rollout-safety"
    ]);
  });
});
