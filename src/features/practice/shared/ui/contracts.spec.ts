import { describe, expect, it } from "vitest";
import { APPLIED_ENGINEERING_ASSESSMENT_EXPERIENCE } from "@/features/practice/applied-engineering/ui/applied-engineering-experience";
import { ARCHITECTURE_DESIGN_ASSESSMENT_EXPERIENCE } from "@/features/practice/architecture-design/ui/architecture-design-experience";
import { CORE_TECHNICAL_ASSESSMENT_EXPERIENCE } from "@/features/practice/core-technical/ui/core-technical-assessment";

describe("story-practice experience contracts", () => {
  it("declares Core and Applied as shared voice-room assessments", () => {
    expect(CORE_TECHNICAL_ASSESSMENT_EXPERIENCE).toMatchObject({
      mode: "shared-voice-room",
      evidenceAnchorLabel: "Practice evidence"
    });
    expect(APPLIED_ENGINEERING_ASSESSMENT_EXPERIENCE).toMatchObject({
      mode: "shared-voice-room",
      evidenceAnchorLabel: "Production evidence"
    });
  });

  it("keeps Architecture on its current assessment mode during the additive migration", () => {
    expect(ARCHITECTURE_DESIGN_ASSESSMENT_EXPERIENCE).toMatchObject({
      mode: "inline-form",
      evidenceAnchorLabel: "Design evidence"
    });
  });
});
