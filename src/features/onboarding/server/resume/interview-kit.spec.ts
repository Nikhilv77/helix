import type { CandidateResume, ResumeInterviewKit } from "@/lib/shared/types";
import { RESUME_INTERVIEW_KIT_VERSION, ResumeInterviewKitService } from "./interview-kit";

const generated = {
  skillQuestions: [
    {
      skill: "PostgreSQL",
      competency: "Production diagnosis",
      format: "spoken" as const,
      prompt: "How did you diagnose a PostgreSQL query that became slow under production load?",
      options: [],
      answerIndex: 0,
      explanation: "",
      expects: ["uses execution evidence", "explains the chosen fix"]
    }
  ],
  codingTask: {
    skill: "TypeScript",
    language: "typescript",
    title: "Bound concurrent work",
    brief: "Implement a small concurrency limiter.",
    starterCode: "export function limit() { // implement }",
    expects: ["bounds concurrency", "handles rejection"]
  },
  experienceQuestions: [
    {
      prompt:
        "Which production trade-off in Checkout did you personally decide, and what evidence supported it?",
      evidenceAnchor: "Checkout",
      competency: "Decision-making",
      expects: ["personal decision", "supporting evidence"],
      probeIfMissing: "Which alternative did you reject?"
    }
  ]
};

function resume(interviewKit: ResumeInterviewKit | null): CandidateResume {
  return {
    skills: ["PostgreSQL", "TypeScript"],
    experience: [],
    projects: [{ name: "Checkout", summary: "Payment flow", outcome: "", skills: [] }],
    achievements: [],
    interviewKit
  } as unknown as CandidateResume;
}

describe("ResumeInterviewKitService", () => {
  it("regenerates a cached kit from an older question-quality contract", async () => {
    const generateStructured = vi.fn().mockResolvedValue(generated);
    const saveResumeInterviewKit = vi.fn().mockResolvedValue(undefined);
    const service = new ResumeInterviewKitService(
      { generateStructured } as never,
      { saveResumeInterviewKit } as never
    );

    const kit = await service.ensure({
      ownerId: "user-1",
      resume: resume({ ...generated, version: 1 }),
      targetRole: "backend",
      level: "3-5"
    });

    expect(generateStructured).toHaveBeenCalledOnce();
    expect(kit.version).toBe(RESUME_INTERVIEW_KIT_VERSION);
    expect(saveResumeInterviewKit).toHaveBeenCalledWith("user-1", kit);
  });

  it("reuses a kit generated under the current quality contract", async () => {
    const current = { ...generated, version: RESUME_INTERVIEW_KIT_VERSION };
    const generateStructured = vi.fn();
    const saveResumeInterviewKit = vi.fn();
    const service = new ResumeInterviewKitService(
      { generateStructured } as never,
      { saveResumeInterviewKit } as never
    );

    const kit = await service.ensure({
      ownerId: "user-1",
      resume: resume(current),
      targetRole: "backend",
      level: "3-5"
    });

    expect(kit).toBe(current);
    expect(generateStructured).not.toHaveBeenCalled();
    expect(saveResumeInterviewKit).not.toHaveBeenCalled();
  });
});
