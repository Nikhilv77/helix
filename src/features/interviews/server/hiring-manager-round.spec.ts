import { buildHiringManagerPlan, hiringManagerRoundContext } from "./hiring-manager-round";
import type { CandidateResume } from "@/lib/shared/types";

describe("hiring manager round", () => {
  it("uses the same spoken interview contract with a final behavioural agenda", () => {
    const plan = buildHiringManagerPlan();

    expect(plan).toHaveLength(8);
    expect(plan.every((question) => question.answerFormat === "spoken")).toBe(true);
    expect(plan.map((question) => question.stage)).toEqual([
      "career",
      "current-role",
      "project",
      "project",
      "project",
      "behavioral",
      "behavioral",
      "behavioral"
    ]);
    expect(plan.map((question) => question.maxFollowUps)).toEqual([3, 2, 2, 2, 2, 1, 1, 0]);
    expect(plan.every((question) => question.probeIfMissing !== undefined)).toBe(true);
    expect(plan.slice(0, -1).every((question) => !question.acceptsCandidateQuestions)).toBe(true);
    expect(plan.at(-1)?.acceptsCandidateQuestions).toBe(true);
    expect(
      plan
        .filter((question) => question.requiredForPacing)
        .map((question) => question.pacingSection)
    ).toEqual([
      "introduction",
      "role-fit",
      "how-you-work",
      "final-conversation",
      "candidate-close"
    ]);
    expect(hiringManagerRoundContext()).toContain("hiring manager");
    expect(hiringManagerRoundContext()).toContain("real conversation rather than a checklist");
  });

  it("grounds the opening, proud-work, and role-fit questions in the resume and target job", () => {
    const resume = {
      experience: [{ role: "Senior Engineer", organization: "Northstar" }],
      projects: [{ name: "Ledger Guard" }]
    } as CandidateResume;
    const input = {
      resume,
      targetRole: "backend" as const,
      targetCompany: "Acme"
    };

    const plan = buildHiringManagerPlan(input);

    expect(plan[0]?.text).toContain("Senior Engineer at Northstar");
    expect(plan[1]?.text).toContain("Backend Engineer role at Acme");
    expect(plan[2]?.text).toContain("Ledger Guard");
    expect(hiringManagerRoundContext(input)).toContain(
      "preparing for a Backend Engineer role at Acme"
    );
  });

  it("sanitizes and bounds candidate-authored labels before placing them in spoken questions", () => {
    const plan = buildHiringManagerPlan({
      resume: {
        experience: [{ role: "Engineer\n\u0000", organization: "Example?" }],
        projects: [{ name: `Project ${"x".repeat(200)}` }]
      } as CandidateResume,
      targetRole: "frontend",
      targetCompany: "Company?"
    });

    expect(plan[0]?.text).not.toContain("\n");
    expect(plan[1]?.text).toContain("Frontend Engineer role at Company");
    expect(plan[2]?.text.length).toBeLessThan(260);
  });
});
