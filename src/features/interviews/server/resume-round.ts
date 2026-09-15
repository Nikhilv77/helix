import type { CandidateResume, ResumeInterviewKit } from "@/lib/shared/types";
import type { InterviewSetup, PlannedQuestion } from "./types";

export const RESUME_SKILL_QUESTIONS = 4;
export const RESUME_EXPERIENCE_QUESTIONS = 3;
const LIVE_RESUME_SKILL_QUESTIONS = 2;
const LIVE_RESUME_EXPERIENCE_QUESTIONS = 2;

const RESUME_PARAMETERS = {
  career: ["claim-credibility", "specificity", "communication"],
  ownership: [
    "claim-credibility",
    "personal-ownership",
    "specificity",
    "impact-learning",
    "communication"
  ],
  decision: [
    "claim-credibility",
    "personal-ownership",
    "decision-making",
    "specificity",
    "impact-learning",
    "communication"
  ],
  behavioural: [
    "personal-ownership",
    "decision-making",
    "specificity",
    "impact-learning",
    "communication"
  ],
  skill: ["claim-credibility", "decision-making", "specificity", "communication"],
  code: [
    "claim-credibility",
    "personal-ownership",
    "decision-making",
    "specificity",
    "communication"
  ]
} as const;

/**
 * Turns the stored kit into the round's plan.
 *
 * Everything here is assembly, not generation. The kit was written once when
 * the resume was read, so starting a resume round costs no model call: the
 * skills stage, the coding task, and the experience stage are all already on
 * the candidate's profile.
 */
export function buildResumePlan(
  kit: ResumeInterviewKit,
  options: { shuffle?: <T>(items: T[]) => T[]; resume?: CandidateResume } = {}
): PlannedQuestion[] {
  const shuffle = options.shuffle ?? shuffleInPlace;

  // Skills are drawn at random so the same resume does not produce the same
  // round twice, while each stage keeps its fixed position in the arc.
  // Keep one practical skill check when there is a coding task and use the
  // freed slot for a second skill when there is not. Together with the career,
  // project, behavioural and experience sections this keeps a full round at
  // eight questions instead of the previous twelve-question sprint.
  const skillQuestionCount = options.resume
    ? kit.codingTask
      ? 1
      : LIVE_RESUME_SKILL_QUESTIONS
    : RESUME_SKILL_QUESTIONS;
  const skills = shuffle([...kit.skillQuestions]).slice(0, skillQuestionCount);
  const experience = kit.experienceQuestions.slice(
    0,
    options.resume ? LIVE_RESUME_EXPERIENCE_QUESTIONS : RESUME_EXPERIENCE_QUESTIONS
  );
  const role = options.resume?.experience[0];
  const project = options.resume?.projects[0];
  const openingQuestions: PlannedQuestion[] = options.resume
    ? [
        conversationalQuestion(
          "Give me the two-minute version of your career so far: the choices you made, the work you own now, and why it prepares you for this role.",
          "Career narrative",
          "Learn the candidate's current scope and the thread they believe matters most.",
          ["a concise career story", "current responsibilities", "one relevant example"],
          "career",
          "about-you",
          true,
          RESUME_PARAMETERS.career
        ),
        conversationalQuestion(
          role
            ? `At ${role.organization || "your current company"}, what outcome were you personally accountable for as ${role.role || "part of the team"}, and which difficult decision best demonstrates your level?`
            : "In your most recent work, what outcome were you personally accountable for, and which difficult decision best demonstrates your level?",
          role?.summary || "Current role",
          "Establish personal ownership, constraints, and impact in the candidate's recent work.",
          ["specific responsibility", "a difficult problem", "personal action or decision"],
          "current-role",
          "about-you",
          false,
          RESUME_PARAMETERS.ownership
        ),
        conversationalQuestion(
          project
            ? `Let's examine ${project.name}. What constraint shaped the design, which alternative did you reject, what did you personally implement, and what evidence showed it worked?`
            : "Choose your strongest project. What constraint shaped the design, which alternative did you reject, what did you personally implement, and what evidence showed it worked?",
          project?.summary || "Project deep dive",
          "Test project ownership, technical judgement, and measurable outcomes.",
          ["problem and constraints", "candidate's design decision", "trade-off", "outcome"],
          "project",
          "your-work",
          true,
          RESUME_PARAMETERS.decision
        ),
        conversationalQuestion(
          "Tell me about a meaningful project setback or mistake. How did you diagnose your part in it, repair the impact, and change how you worked afterward?",
          "Behavioural evidence",
          "Collect evidence of ownership, judgement, and learning under pressure.",
          ["specific situation", "personal action", "result", "lesson learned"],
          "behavioral",
          "how-you-work",
          true,
          RESUME_PARAMETERS.behavioural
        )
      ]
    : [];

  const skillQuestions: PlannedQuestion[] = skills.map((question, index) => ({
    text: question.prompt,
    evidenceAnchor: question.skill,
    kind: question.format === "mcq" ? "mcq" : "conversation",
    stage: "skills",
    skill: question.skill,
    language: "",
    codeTask: "",
    codeSnippet: "",
    options: question.format === "mcq" ? question.options : undefined,
    answerIndex: question.format === "mcq" ? question.answerIndex : undefined,
    explanation: question.explanation || undefined,
    answerFormat: question.format,
    competency: question.competency,
    evaluationParameterKeys:
      question.format === "mcq" ? ["claim-credibility"] : [...RESUME_PARAMETERS.skill],
    intent: `Establish whether the candidate really uses ${question.skill || "this skill"} rather than listing it.`,
    mustHit: withMinimum(question.expects, [
      `concrete use of ${question.skill || "the skill"}`,
      "reasoning behind the choice"
    ]),
    maxFollowUps: 1,
    probeIfMissing: `Where exactly did you use ${question.skill || "that"} in your own work?`,
    pacingSection: "technical",
    requiredForPacing: !kit.codingTask && index === 0,
    estimatedDurationMs: 2 * 60 * 1000
  }));

  const codeQuestions: PlannedQuestion[] = kit.codingTask
    ? [
        {
          text: `Let's write a little code. ${kit.codingTask.title}.`,
          evidenceAnchor: kit.codingTask.skill || kit.codingTask.title,
          kind: "code",
          stage: "code",
          skill: kit.codingTask.skill,
          language: kit.codingTask.language,
          codeTask: kit.codingTask.brief,
          codeSnippet: kit.codingTask.starterCode,
          answerFormat: "typed",
          competency: "Practical engineering",
          evaluationParameterKeys: [...RESUME_PARAMETERS.code],
          intent: "Test whether the candidate can write the code their resume claims they write.",
          mustHit: withMinimum(kit.codingTask.expects, [
            "a working implementation",
            "an explanation of the approach"
          ]),
          maxFollowUps: 1,
          probeIfMissing: "Walk me through what your version does, line by line.",
          pacingSection: "technical",
          requiredForPacing: true,
          estimatedDurationMs: 4 * 60 * 1000
        }
      ]
    : [];

  const experienceQuestions: PlannedQuestion[] = experience.map((question) => ({
    text: question.prompt,
    evidenceAnchor: question.evidenceAnchor,
    kind: "conversation",
    stage: "experience",
    language: "",
    codeTask: "",
    codeSnippet: "",
    answerFormat: "spoken",
    competency: question.competency,
    evaluationParameterKeys: [...experienceParameterKeys(question.competency)],
    intent: "Collect concrete evidence of what the candidate personally did and what changed.",
    mustHit: withMinimum(question.expects, ["what they personally did", "why it mattered"]),
    maxFollowUps: 1,
    probeIfMissing:
      question.probeIfMissing || "Which part would not have happened without your contribution?",
    pacingSection: "your-work",
    estimatedDurationMs: 2.5 * 60 * 1000
  }));

  return options.resume
    ? [
        ...openingQuestions.slice(0, 3),
        ...experienceQuestions,
        ...openingQuestions.slice(3),
        ...skillQuestions,
        ...codeQuestions
      ]
    : [...skillQuestions, ...codeQuestions, ...experienceQuestions];
}

function conversationalQuestion(
  text: string,
  evidenceAnchor: string,
  intent: string,
  mustHit: string[],
  stage: "career" | "current-role" | "project" | "behavioral",
  pacingSection: string,
  requiredForPacing = false,
  evaluationParameterKeys: readonly string[] = RESUME_PARAMETERS.decision
): PlannedQuestion {
  const competency = {
    career: "Career overview",
    "current-role": "Current role",
    project: "Project deep-dive",
    behavioral: "Behavioural evidence"
  }[stage];

  return {
    text,
    evidenceAnchor,
    kind: "conversation",
    stage,
    language: "",
    codeTask: "",
    codeSnippet: "",
    answerFormat: "spoken",
    competency,
    evaluationParameterKeys: [...evaluationParameterKeys],
    intent,
    mustHit,
    maxFollowUps: 1,
    probeIfMissing: "What did you personally do, and what changed as a result?",
    pacingSection,
    requiredForPacing,
    estimatedDurationMs: 2.5 * 60 * 1000
  };
}

function experienceParameterKeys(competency: string): readonly string[] {
  const normalized = competency.toLowerCase();
  if (/impact|outcome|result|learning/.test(normalized)) {
    return ["claim-credibility", "specificity", "impact-learning", "communication"];
  }
  if (/owner|responsib|leadership/.test(normalized)) return RESUME_PARAMETERS.ownership;
  return RESUME_PARAMETERS.decision;
}

/** The spoken opener, so the candidate knows how the round is laid out. */
export function resumeRoundContext(resume: CandidateResume, kit: ResumeInterviewKit): string {
  const skills = kit.skillQuestions.map((question) => question.skill).filter(Boolean);

  return [
    "This is a resume and behavioural round. Start with the candidate's background, then examine their work and project claims, discuss one behavioural example, and finish with technical judgement.",
    skills.length ? `Skills under test: ${skills.join(", ")}.` : "",
    resume.experience.length
      ? `Roles on the resume: ${resume.experience
          .slice(0, 3)
          .map((entry) => [entry.role, entry.organization].filter(Boolean).join(" at "))
          .filter(Boolean)
          .join("; ")}.`
      : "",
    "Treat every resume claim as something to verify, not to praise."
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1200);
}

/**
 * Grades a multiple choice answer without a model call. The candidate submits
 * the option text, which is what the transcript should show anyway.
 */
export function gradeMultipleChoice(
  question: PlannedQuestion,
  answer: string
): { correct: boolean; chosen: string | null } | null {
  if (question.kind !== "mcq" || !question.options?.length) return null;

  const normalized = normalizeChoiceText(answer);
  let chosenIndex = question.options.findIndex(
    (option) => normalizeChoiceText(option) === normalized
  );
  if (chosenIndex === -1) {
    chosenIndex = spokenChoiceIndex(answer, question.options);
  }
  if (chosenIndex === -1) return { correct: false, chosen: null };

  return {
    correct: chosenIndex === (question.answerIndex ?? 0),
    chosen: question.options[chosenIndex] ?? null
  };
}

function spokenChoiceIndex(answer: string, options: string[]): number {
  const normalized = normalizeChoiceText(answer);
  const letterOnly = normalized.match(/^([a-z])$/i);
  const labelled = [
    /^(?:option|answer)\s+([a-z])\b/i,
    /^(?:i (?:choose|pick)|i(?:'ll| will) go with|my answer is|the answer is)\s+(?:option\s+)?([a-z])\b/i,
    /^i (?:think|believe)(?: (?:it|the answer) is)?\s+(?:option\s+)?([a-z])\b/i
  ]
    .map((pattern) => normalized.match(pattern))
    .find(Boolean);
  const letter = letterOnly?.[1] ?? labelled?.[1];
  if (letter) {
    const index = letter.toLowerCase().charCodeAt(0) - 97;
    if (index >= 0 && index < options.length) return index;
  }

  const contained = options
    .map((option, index) => ({ option: normalizeChoiceText(option), index }))
    .filter(({ option }) => option.length >= 4 && normalized.includes(option));
  return contained.length === 1 ? contained[0]!.index : -1;
}

function normalizeChoiceText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, " ")
    .trim();
}

/** What Maya says after grading, in place of a decision call. */
export function multipleChoiceReply(question: PlannedQuestion, correct: boolean): string {
  const explanation = question.explanation?.trim();

  if (correct) {
    return explanation ? `That's right. ${explanation}` : "That's right.";
  }

  const answer = question.options?.[question.answerIndex ?? 0];
  if (!answer) return "Not quite, but let's keep going.";

  return explanation ? `Not quite — it's ${answer}. ${explanation}` : `Not quite — it's ${answer}.`;
}

export function isResumeRoundSetup(setup: InterviewSetup): boolean {
  return setup.resumeRound === true;
}

function withMinimum(values: string[], fallback: string[]): string[] {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  return cleaned.length >= 2 ? cleaned.slice(0, 3) : fallback;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex]!, items[index]!];
  }
  return items;
}
