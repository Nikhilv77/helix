import type { CandidateProfile } from "@/lib/shared/types";
import type { InterviewState } from "@/features/interviews/server/types";
import {
  buildSystemInstruction,
  buildTranscriptionAudioConfig,
  buildTranscriptionVocabulary
} from "./route";

describe("Gemini Live interview instruction", () => {
  it("lets Gemini lead the hiring-manager conversation through an authoritative tool", () => {
    const instruction = buildSystemInstruction({
      roundTitle: "Hiring Manager & Final Behavioural",
      isResumeRound: true,
      isHiringManagerRound: true,
      question: "Why did you choose this career?",
      questionNumber: 1,
      questionCount: 8,
      followUpCount: 0,
      maxFollowUps: 2,
      mustHit: ["motivation"],
      openingUtterance: "Hi. Why did you choose this career?",
      pronunciationVocabulary: ["NovaCart", "React.js"]
    });

    expect(instruction).toContain("call complete_interview_turn exactly once");
    expect(instruction).toContain("Respond naturally and concisely");
    expect(instruction).toContain("must preserve the meaning");
    expect(instruction).toContain("NovaCart, React.js");
    expect(instruction).toContain("Never invent an interview question");
    expect(instruction).toContain(`say exactly: "I'm James from the recruiting team."`);
    expect(instruction).toContain("Never mention Google, Gemini, DeepMind");
    expect(instruction).toContain("the 30-minute limit is only a maximum");
    expect(instruction).toContain("Do not ask them to confirm");
  });

  it("keeps non-hiring-manager rounds on the existing server-led contract", () => {
    const instruction = buildSystemInstruction({
      roundTitle: "Core Technical",
      isResumeRound: false,
      isHiringManagerRound: false,
      question: "How does event-loop scheduling work?",
      questionNumber: 1,
      questionCount: 4,
      followUpCount: 0,
      maxFollowUps: 1,
      mustHit: ["microtasks"],
      openingUtterance: "Hi. How does event-loop scheduling work?"
    });

    expect(instruction).toContain("browser submits the finalized transcript directly");
    expect(instruction).toContain("Wait silently for the server's next text instruction");
    expect(instruction).not.toContain("call complete_interview_turn exactly once");
  });
});

describe("Gemini Live interview transcription vocabulary", () => {
  it("preserves spoken wording with English and Hindi language hints", () => {
    expect(buildTranscriptionAudioConfig(["NovaCart", "React.js"])).toEqual({
      languageCodes: ["en-IN", "hi-IN"],
      customVocabulary: ["NovaCart", "React.js"],
      mode: "VERBATIM"
    });
  });

  it("biases recognition with the candidate's resume, target and interview terminology", () => {
    const state = {
      setup: {
        role: "fullstack",
        level: "3-5",
        roundType: "hiring-manager",
        intensity: "realistic",
        context: "Full-Stack Engineer at NovaCart Technologies",
        agenda: ["Discuss React and Node.js ownership"]
      },
      plan: [
        {
          text: "At NovaCart Technologies, how did you use React Query?",
          evidenceAnchor: "Software Engineer at NovaCart Technologies",
          skill: "React Query",
          competency: "Frontend architecture",
          mustHit: ["technical ownership"],
          probeIfMissing: "What did you personally own?"
        }
      ]
    } as InterviewState;
    const profile = {
      targetRole: "fullstack",
      targetCompany: "Example Labs",
      headline: "Full-Stack Engineer",
      focusAreas: ["System Design"],
      resume: {
        fullName: "Aarav Verma",
        skills: ["React Query", "TypeScript"],
        certifications: ["AWS Certified Developer"],
        experience: [
          {
            organization: "NovaCart Technologies",
            role: "Software Engineer",
            skills: ["React Query"]
          }
        ],
        projects: [{ name: "CartFlow", skills: ["Node.js"] }],
        education: [
          {
            institution: "Delhi Technical University",
            credential: "B.Tech",
            field: "Computer Science"
          }
        ]
      }
    } as CandidateProfile;

    const vocabulary = buildTranscriptionVocabulary(state, profile);

    expect(vocabulary).toContain("NovaCart Technologies");
    expect(vocabulary).toContain("React Query");
    expect(vocabulary).toContain("CartFlow");
    expect(vocabulary).toContain("Example Labs");
    expect(vocabulary).toContain("Aarav Verma");
    expect(vocabulary.length).toBeLessThanOrEqual(100);
  });
});
