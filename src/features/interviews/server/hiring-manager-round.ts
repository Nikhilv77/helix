import type { CandidateResume, Level, Role } from "@/lib/shared/types";
import type { PlannedQuestion } from "./types";

export interface HiringManagerPlanContext {
  resume?: CandidateResume | null;
  targetRole?: Role | null;
  targetCompany?: string | null;
  level?: Level | null;
}

/**
 * The final behavioural round intentionally uses the same durable interview
 * engine as the resume room. Only the agenda changes: this round tests how a
 * candidate works, chooses, and communicates with a hiring manager. The resume
 * round already walks through the career story and the main project, so this
 * one asks where the candidate is going, how they learn, and how they work
 * with people.
 */
export function buildHiringManagerPlan(input: HiringManagerPlanContext = {}): PlannedQuestion[] {
  const currentRole = input.resume?.experience[0];
  const currentRoleLabel = joinRoleAndCompany(currentRole?.role, currentRole?.organization);
  const targetJob = joinTargetJob(input.targetRole, input.targetCompany);
  // A fresher has no current employer or manager to talk about yet; college,
  // internships, and personal projects are their evidence.
  const fresher = input.level === "fresher";

  return [
    question(
      fresher
        ? "Where do you want your career to go over the next few years, and what drew you to this direction for your first role?"
        : currentRoleLabel
          ? `You're currently working ${currentRoleLabel}. Where do you want your career to go over the next few years, and why is now the right time for a change?`
          : "Where do you want your career to go over the next few years, and why is now the right time for a change?",
      "Career direction and motivation",
      fresher
        ? ["where they want to go", "why this direction", "what they have done about it so far"]
        : ["where they want to go", "their current situation", "the reason for their next move"],
      "career",
      "What was the moment you knew this was the direction you wanted?",
      3,
      false,
      "introduction",
      true
    ),
    question(
      targetJob
        ? `What kind of work gives you energy, and what drains you? How does ${targetJob} fit with that?`
        : "What kind of work gives you energy, and what drains you? How does your next role fit with that?",
      "Role motivation and fit",
      ["what energises them", "what drains them", "realistic role priorities"],
      "current-role",
      "Can you give me a recent example of work that gave you energy?",
      2,
      false,
      "role-fit",
      true
    ),
    question(
      fresher
        ? "Tell me about a time you had to learn something unfamiliar quickly to finish a project, at college, an internship, or on your own. How did you go about it?"
        : "Tell me about a time you had to learn something unfamiliar quickly to deliver. How did you go about it?",
      "Learning and ownership",
      ["what they had to learn", "how they went about it", "what they delivered"],
      "project",
      "What would you do differently if you had to learn it again?",
      2,
      false,
      "how-you-work",
      true
    ),
    question(
      "Tell me about a time priorities changed or the situation was unclear. How did you decide what to do next?",
      "Judgement under uncertainty",
      ["the situation", "the decision they made", "what happened afterward"],
      "project",
      "What decision did you personally make before you had all the information?",
      2,
      false,
      "how-you-work"
    ),
    question(
      fresher
        ? "Tell me about a disagreement with a teammate or a lead on a project. What did you do, and how did it end?"
        : "Tell me about a disagreement with a teammate or manager. What did you do, and how did it end?",
      "Collaboration and conflict",
      ["the disagreement", "their own response", "the outcome or relationship afterward"],
      "project",
      "What did you personally say or do that helped move the disagreement forward?",
      2,
      false,
      "how-you-work"
    ),
    question(
      "Tell me about a mistake or setback you were responsible for. How did you handle it?",
      "Accountability and recovery",
      ["the mistake or setback", "how they took responsibility", "the repair or lesson"],
      "behavioral",
      "What did you change afterward to stop the same problem happening again?",
      1,
      false,
      "final-conversation",
      true
    ),
    question(
      fresher
        ? "What is a piece of difficult feedback you received, from a teacher, a lead, or a teammate, and what did you change because of it?"
        : "What is a piece of difficult feedback you received, and what did you change because of it?",
      "Self-awareness and growth",
      ["the specific feedback", "how they responded", "a real change in behaviour"],
      "behavioral",
      "What would someone who works with you notice is different now?",
      1,
      false,
      "final-conversation"
    ),
    question(
      "Before we wrap up, what matters most to you in a team and manager, and what would you like to ask me?",
      "Candidate priorities and close",
      ["team or manager priorities", "thoughtful questions", "clear decision criteria"],
      "behavioral",
      "",
      0,
      true,
      "candidate-close",
      true,
      2 * 60 * 1000
    )
  ];
}

export function hiringManagerRoundContext(input: HiringManagerPlanContext = {}): string {
  const targetJob = joinTargetJob(input.targetRole, input.targetCompany);
  const currentRole = joinRoleAndCompany(
    input.resume?.experience[0]?.role,
    input.resume?.experience[0]?.organization
  );

  return [
    "This is a hiring manager and final behavioural interview.",
    targetJob ? `The candidate is preparing for ${targetJob}.` : "",
    input.level === "fresher"
      ? "The candidate is early in their career. Accept examples from college, internships, hackathons, and personal projects as fully valid evidence."
      : currentRole
        ? `The candidate currently works ${currentRole}.`
        : "",
    "The resume round already covered their career story and main project. Do not re-run a project deep dive here.",
    "Assess how the candidate communicates, works through ambiguity, collaborates, learns from feedback, and decides whether a role is right for them.",
    "Build a real conversation rather than a checklist. The introduction may use up to three connected follow-ups. Role-fit and how-you-work questions may use up to two. Follow the candidate's actual words, probe vague claims gently, and explore the judgement or reflection behind a credible answer.",
    "Keep the final conversation lighter: one useful follow-up at most, no interrogation, and give the candidate room to ask questions."
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1400);
}

function question(
  text: string,
  competency: string,
  mustHit: string[],
  stage: PlannedQuestion["stage"],
  probeIfMissing: string,
  maxFollowUps = 1,
  acceptsCandidateQuestions = false,
  pacingSection: string = stage ?? "general",
  requiredForPacing = false,
  estimatedDurationMs = 3 * 60 * 1000
): PlannedQuestion {
  return {
    text,
    evidenceAnchor: competency,
    kind: "conversation",
    stage,
    language: "",
    codeTask: "",
    codeSnippet: "",
    answerFormat: "spoken",
    competency,
    intent: `Understand the candidate's ${competency.toLowerCase()}.`,
    mustHit,
    maxFollowUps,
    probeIfMissing,
    acceptsCandidateQuestions,
    pacingSection,
    requiredForPacing,
    estimatedDurationMs
  };
}

function joinRoleAndCompany(role: string | undefined, company: string | undefined): string {
  const safeRole = cleanInline(role, 70);
  const safeCompany = cleanInline(company, 70);
  if (safeRole && safeCompany) return `as ${safeRole} at ${safeCompany}`;
  if (safeRole) return `as ${safeRole}`;
  if (safeCompany) return `at ${safeCompany}`;
  return "";
}

function joinTargetJob(role: Role | null | undefined, company: string | null | undefined): string {
  const roleLabel = role ? ROLE_LABELS[role] : "";
  const safeCompany = cleanInline(company, 70);
  if (roleLabel && safeCompany) return `a ${roleLabel} role at ${safeCompany}`;
  if (roleLabel) return `a ${roleLabel} role`;
  if (safeCompany) return `a role at ${safeCompany}`;
  return "";
}

function cleanInline(value: string | null | undefined, maxLength: number): string {
  const printable = Array.from(value ?? "", (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? " " : character;
  }).join("");

  return printable
    .replace(/\s+/g, " ")
    .replace(/[?!]+$/g, "")
    .trim()
    .slice(0, maxLength)
    .trim();
}

const ROLE_LABELS: Record<Role, string> = {
  backend: "Backend Engineer",
  frontend: "Frontend Engineer",
  fullstack: "Full-stack Engineer",
  data: "Data Engineer",
  "ai-ml": "AI/ML Engineer",
  pm: "Product Manager"
};
