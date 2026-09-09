import { describe, expect, it } from "vitest";
import type { ArchitectureDesignPublicBlock } from "@/features/practice/architecture-design/server/practice.service";
import { architectureDesignBlockView } from "./architecture-design-adapter";
import { ARCHITECTURE_DESIGN_WORKSPACE_EXPERIENCE } from "./architecture-design-experience";

describe("Architecture & Design presentation adapter", () => {
  it("maps design feedback, assessment measures, and the non-executable capability shape", () => {
    const view = architectureDesignBlockView({
      scenario: {
        key: "webhooks",
        premise: "Design a multi-tenant webhook delivery system.",
        dimensionKeys: ["requirements-framing"],
        stages: []
      },
      selection: { difficulty: "standard", reason: "Role-aligned evidence" },
      questions: [
        {
          question: { format: "written", topicKeys: [], artifact: {} },
          authorizedAnswer: { summary: "Bound the scope", explanation: "State the SLO." },
          latestAttempt: {
            feedback: {
              schemaVersion: 1,
              score: 8,
              result: "Defensible design",
              constraintUse: "Used the traffic peak.",
              designReasoning: "Separated acceptance from delivery.",
              tradeoffQuality: "Quantify the rejected option.",
              operationalSafety: "Isolated unhealthy tenants.",
              communicationQuality: "Led with assumptions.",
              interviewerFollowUp: "How would you migrate it?",
              missedConsiderations: ["Regional recovery"]
            }
          }
        }
      ],
      assessment: null
    } as unknown as ArchitectureDesignPublicBlock);

    expect(view.questions[0]).toMatchObject({
      latestRun: null,
      authorizedAnswer: { concise: "Bound the scope", explanation: "State the SLO." },
      latestAttempt: {
        feedback: {
          didWell: "Used the traffic peak.",
          mechanism: "Separated acceptance from delivery.",
          productionConsequence: "Isolated unhealthy tenants.",
          missedEdgeCases: ["Regional recovery"]
        }
      }
    });
    expect(view.story).toMatchObject({
      incident: "Design a multi-tenant webhook delivery system.",
      difficulty: "standard",
      mechanismKeys: ["requirements-framing"]
    });
    expect(ARCHITECTURE_DESIGN_WORKSPACE_EXPERIENCE.capabilities).toEqual({ runCode: false });
  });
});
