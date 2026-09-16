import type { CandidateProfile } from "@/lib/shared/types";
import type { InterviewState } from "@/features/interviews/server/types";
import {
  buildOpeningUtterance,
  buildSystemInstruction,
  buildTranscriptionAudioConfig,
  buildTranscriptionVocabulary
} from "./route";

describe("Gemini Live interview instruction", () => {
  it("lets Gemini lead the hiring-manager conversation through an authoritative tool", () => {
    const instruction = buildSystemInstruction({
      roundTitle: "Hiring Manager & Final Behavioural",
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
    expect(instruction).toContain("Speak approvedResponse exactly once, word for word");
    expect(instruction).toContain('for example, "no idea", "I have no clue"');
    expect(instruction).toContain("This rule overrides the normal probe rules");
    expect(instruction).toContain("not merely because the answer was specific");
    expect(instruction).toContain("If an answer describes violence");
    expect(instruction).toContain("ask one concise question about accountability");
    expect(instruction).toContain("NovaCart, React.js");
    expect(instruction).toContain("Never invent an interview question");
    expect(instruction).toContain(`say exactly: "I'm James from the recruiting team."`);
    expect(instruction).toContain("Never mention Google, Gemini, DeepMind");
    expect(instruction).toContain("the 30-minute limit is only a maximum");
    expect(instruction).toContain("Do not ask them to confirm");
  });

  it("lets Gemini lead a resume interview while keeping the frozen resume plan", () => {
    const instruction = buildSystemInstruction({
      roundTitle: "Resume and Behavioral Defense",
      isHiringManagerRound: false,
      isResumeBehaviouralRound: true,
      question: "What outcome did you own at NovaCart?",
      questionNumber: 1,
      questionCount: 8,
      followUpCount: 0,
      maxFollowUps: 1,
      mustHit: ["personal ownership", "evidence of impact"],
      openingUtterance: "Hi. What outcome did you own at NovaCart?",
      plan: [
        {
          text: "Which diagnostic step comes first?",
          kind: "mcq",
          answerFormat: "mcq",
          options: ["Add an index", "Run ANALYZE"],
          mustHit: ["personal ownership", "evidence of impact"],
          maxFollowUps: 1,
          acceptsCandidateQuestions: false
        }
      ]
    });

    expect(instruction).toContain("call complete_interview_turn exactly once");
    expect(instruction).toContain("Verify the candidate's own resume claims");
    expect(instruction).toContain("Frozen interview plan");
    expect(instruction).toContain("Choices: A. Add an index; B. Run ANALYZE");
    expect(instruction).toContain("say its letter");
    expect(instruction).toContain("Speak approvedResponse exactly once, word for word");
    expect(instruction).toContain(`say exactly: "I'm James from the recruiting team."`);
  });

  it("continues a reconnected conversation from persisted history", () => {
    const instruction = buildSystemInstruction({
      roundTitle: "Hiring Manager & Final Behavioural",
      isHiringManagerRound: true,
      question: "What did you personally change?",
      questionNumber: 4,
      questionCount: 8,
      followUpCount: 1,
      maxFollowUps: 2,
      mustHit: ["personal action"],
      openingUtterance: "Welcome back. We'll continue where we left off.",
      resuming: true,
      conversationHistory: [
        { speaker: "agent", text: "Tell me about the incident." },
        { speaker: "user", text: "I investigated the failed deployment." }
      ]
    });

    expect(instruction).toContain("This is a resumed connection to the same interview");
    expect(instruction).toContain("Continue from planned question 4");
    expect(instruction).toContain("Candidate: I investigated the failed deployment.");
    expect(instruction).toContain("do not restart the interview");
  });

  it("gives Claire the silent coding and connected design contract", () => {
    const instruction = buildSystemInstruction({
      roundTitle: "DSA & Design interview",
      interviewerName: "Claire",
      isHiringManagerRound: false,
      isDsaDesignRound: true,
      question: "Walk me through Two Sum.",
      questionNumber: 1,
      questionCount: 5,
      followUpCount: 0,
      maxFollowUps: 1,
      mustHit: ["approach", "complexity"],
      openingUtterance: buildOpeningUtterance({
        isHiringManagerRound: false,
        question: "Walk me through Two Sum.",
        isDsaDesignRound: true
      }),
      plan: [
        {
          text: "Walk me through Two Sum.",
          kind: "code",
          answerFormat: "typed",
          mustHit: ["approach", "complexity"],
          maxFollowUps: 1,
          acceptsCandidateQuestions: false
        },
        {
          text: "Frame the design.",
          kind: "conversation",
          answerFormat: "spoken",
          mustHit: ["scope"],
          maxFollowUps: 1,
          acceptsCandidateQuestions: false
        }
      ]
    });

    expect(instruction).toContain("You are Claire, a calm and technically sharp");
    expect(instruction).toContain("Stay quiet while the candidate types");
    expect(instruction).toContain("Wait for the workspace code submission");
    expect(instruction).toContain("Keep all three design prompts on the same scenario");
    expect(instruction).toContain("merely says they are thinking");
    expect(instruction).toContain("Take your time—go ahead when you're ready.");
    expect(instruction).toContain("talk through a tentative approach");
    expect(instruction).toContain("do not interrupt active typing");
    expect(instruction).toContain("If approvedResponse is empty, produce no audio");
    expect(instruction).toContain("Never invent an employer fact");
    expect(instruction).toContain('say exactly: "I\'m Claire from the recruiting team."');
  });

  it("resumes Claire on the current DSA & Design question", () => {
    const instruction = buildSystemInstruction({
      roundTitle: "DSA & Design interview",
      interviewerName: "Claire",
      isHiringManagerRound: false,
      isDsaDesignRound: true,
      question: "Defend the architecture.",
      questionNumber: 5,
      questionCount: 5,
      followUpCount: 0,
      maxFollowUps: 1,
      mustHit: ["reliability"],
      openingUtterance: "Welcome back. Defend the architecture.",
      resuming: true,
      conversationHistory: [
        { speaker: "agent", text: "Design the data flow." },
        { speaker: "user", text: "I would partition by account." }
      ]
    });

    expect(instruction).toContain("Continue from planned question 5");
    expect(instruction).toContain("Candidate: I would partition by account.");
    expect(instruction).toContain("do not restart");
  });

  it("gives Claire a no-spoilers technical calibration and grounded project contract", () => {
    const question = "Which database guarantee matters most here?";
    const openingUtterance = buildOpeningUtterance({
      isHiringManagerRound: false,
      isTechnicalProjectsRound: true,
      question
    });
    const instruction = buildSystemInstruction({
      roundTitle: "Core Technical & Projects interview",
      interviewerName: "Claire",
      isHiringManagerRound: false,
      isTechnicalProjectsRound: true,
      question,
      questionNumber: 1,
      questionCount: 7,
      followUpCount: 0,
      maxFollowUps: 0,
      mustHit: ["transaction isolation"],
      openingUtterance,
      plan: [
        {
          text: question,
          kind: "mcq",
          answerFormat: "mcq",
          options: ["Atomicity", "Isolation", "Durability"],
          mustHit: ["transaction isolation"],
          maxFollowUps: 0,
          acceptsCandidateQuestions: false
        },
        {
          text: "Trace the request through your project.",
          kind: "conversation",
          answerFormat: "spoken",
          mustHit: ["mechanism", "personal ownership"],
          maxFollowUps: 2,
          acceptsCandidateQuestions: false
        }
      ]
    });

    expect(openingUtterance).toContain("I'm Claire");
    expect(openingUtterance).toContain("three short technical decisions");
    expect(instruction).toContain("never announce whether an answer is correct");
    expect(instruction).toContain("The remaining questions stay on one grounded project");
    expect(instruction).toContain("Never invent project facts");
    expect(instruction).toContain("Choices: A. Atomicity; B. Isolation; C. Durability");
    expect(instruction).toContain("the 40-minute limit is only a maximum");
    expect(instruction).toContain('say exactly: "I\'m Claire from the recruiting team."');
  });

  it("keeps non-hiring-manager rounds on the existing server-led contract", () => {
    const instruction = buildSystemInstruction({
      roundTitle: "Core Technical",
      interviewerName: "Claire",
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
    expect(instruction).toContain("You are Claire");
    expect(instruction).not.toContain("You are James");
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
