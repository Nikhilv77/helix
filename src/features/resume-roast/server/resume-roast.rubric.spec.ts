import type { ResumeRoastTarget } from "@/features/resume-roast/contracts/resume-roast";
import { resumeRoastScoreMeaning } from "@/features/resume-roast/contracts/resume-roast";
import {
  computeResumeRoastOverall,
  resumeRoastBandFor,
  resumeRoastRubricText,
  resumeRoastWeights
} from "./resume-roast.rubric";

const senior: ResumeRoastTarget = {
  role: "backend-engineer",
  companyEnvironment: "product-company",
  level: "senior"
};
const newGrad: ResumeRoastTarget = { ...senior, level: "internship-or-new-grad" };
const staff: ResumeRoastTarget = { ...senior, level: "staff-or-principal" };

const all = (score: number) => ({
  roleFit: score,
  impact: score,
  ownership: score,
  technical: score,
  readability: score
});

describe("Resume Roast rubric", () => {
  it("maps uniform judgements onto the scale a person expects", () => {
    expect(computeResumeRoastOverall(all(1), senior)).toBe(1);
    expect(computeResumeRoastOverall(all(2), senior)).toBe(3);
    expect(computeResumeRoastOverall(all(3), senior)).toBe(6);
    expect(computeResumeRoastOverall(all(4), senior)).toBe(8);
    expect(computeResumeRoastOverall(all(5), senior)).toBe(10);
  });

  it("is deterministic: the same judgements always give the same score", () => {
    const scores = { roleFit: 4, impact: 3, ownership: 4, technical: 5, readability: 2 };
    const first = computeResumeRoastOverall(scores, senior);
    for (let run = 0; run < 20; run += 1) {
      expect(computeResumeRoastOverall(scores, senior)).toBe(first);
    }
  });

  it("keeps 10 for a resume with nothing left to fix", () => {
    expect(computeResumeRoastOverall({ ...all(5), readability: 4 }, senior)).toBe(9);
  });

  it("caps a resume for the wrong job however polished it is", () => {
    expect(computeResumeRoastOverall({ ...all(5), roleFit: 1 }, senior)).toBe(3);
    expect(computeResumeRoastOverall({ ...all(5), roleFit: 2 }, senior)).toBe(5);
  });

  it("caps senior targets with no sign of the scope they need", () => {
    expect(computeResumeRoastOverall({ ...all(5), ownership: 1 }, senior)).toBe(5);
    // A new grad isn't expected to own systems yet, so no cap.
    expect(computeResumeRoastOverall({ ...all(5), ownership: 1 }, newGrad)).toBeGreaterThan(5);
  });

  it("weights what each level is actually read for", () => {
    expect(resumeRoastWeights(newGrad).technical).toBeGreaterThan(resumeRoastWeights(senior).technical);
    expect(resumeRoastWeights(staff).ownership).toBeGreaterThan(resumeRoastWeights(senior).ownership);
    for (const target of [senior, newGrad, staff]) {
      const weights = resumeRoastWeights(target);
      expect(Object.values(weights).reduce((total, weight) => total + weight, 0)).toBe(100);
    }
  });

  it("derives the band from the score so they can never disagree", () => {
    expect(resumeRoastBandFor(2)).toBe("needs-serious-work");
    expect(resumeRoastBandFor(5)).toBe("has-potential");
    expect(resumeRoastBandFor(7)).toBe("solid");
    expect(resumeRoastBandFor(8)).toBe("strong");
    expect(resumeRoastBandFor(10)).toBe("difficult-to-roast");
  });

  it("describes each score the way a recruiter would", () => {
    expect(resumeRoastScoreMeaning(8).label).toBe("Would shortlist");
    expect(resumeRoastScoreMeaning(5).label).toBe("Borderline");
    expect(resumeRoastScoreMeaning(1).label).toBe("Wrong pile");
  });

  it("puts anchors and the target's weights in the scoring prompt", () => {
    const text = resumeRoastRubricText(staff);
    expect(text).toContain("Level and ownership (ownership, 30% of the score)");
    expect(text).toContain("5: Every recent role and project is squarely this job.");
    expect(text).toContain("Would shortlist");
  });
});
