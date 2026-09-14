import type { CandidateResume, Role } from "@/lib/shared/types";
import type { PlannedQuestion } from "./types";

export interface HiringManagerPlanContext {
  resume?: CandidateResume | null;
  targetRole?: Role | null;
  targetCompany?: string | null;
}

/**
 * The final behavioural round intentionally uses the same durable interview
 * engine as the resume room. Only the agenda changes: this round tests how a
 * candidate works, chooses, and communicates with a hiring manager.
 */
export function buildHiringManagerPlan(input: HiringManagerPlanContext = {}): PlannedQuestion[] {
  const currentRole = input.resume?.experience[0];
  const project = input.resume?.projects[0];
  const currentRoleLabel = joinRoleAndCompany(currentRole?.role, currentRole?.organization);
  const targetJob = joinTargetJob(input.targetRole, input.targetCompany);
  const projectName = cleanInline(project?.name, 80);

  return [
    question(
      currentRoleLabel
        ? `Your resume shows your recent work ${currentRoleLabel}. Could you walk me through the career choices that brought you there and why you are considering a move now?`
        : "Could you walk me through your background and what has brought you to this point in your career?",
      "Career story",
      ["a clear career story", "their current situation", "the reason for their next move"],
      "career",
      "What was the most important turning point in that journey?",
      3,
      false,
      "introduction",
      true
    ),
    question(
      targetJob
        ? `You are targeting ${targetJob}. What is motivating that move, and what would make this kind of role a genuinely good fit for you?`
        : "What is motivating you to make a move now, and what would make your next role a good fit for you?",
      "Role motivation and fit",
      ["why they are considering a move", "what they want next", "realistic role priorities"],
      "current-role",
      "Which one of those priorities matters most to you, and why?",
      2,
      false,
      "role-fit",
      true
    ),
    question(
      projectName
        ? `Your resume highlights ${projectName}. What are you most proud of there, and what was your personal contribution?`
        : "What piece of work are you most proud of, and what was your personal contribution to it?",
      "Ownership and impact",
      ["a specific piece of work", "their personal contribution", "the result or impact"],
      "project",
      "What changed specifically because of your contribution?",
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
      "Tell me about a disagreement with a teammate or manager. What did you do, and how did it end?",
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
      "What is a piece of difficult feedback you received, and what did you change because of it?",
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
  const resumeSignals = [
    joinRoleAndCompany(
      input.resume?.experience[0]?.role,
      input.resume?.experience[0]?.organization
    ),
    cleanInline(input.resume?.projects[0]?.name, 80)
  ].filter((value): value is string => Boolean(value));

  return [
    "This is a hiring manager and final behavioural interview.",
    targetJob ? `The candidate is preparing for ${targetJob}.` : "",
    resumeSignals.length ? `Ground the conversation in: ${resumeSignals.join("; ")}.` : "",
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
