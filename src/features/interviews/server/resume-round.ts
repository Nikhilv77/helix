import type { CandidateResume, ResumeInterviewKit } from "@/lib/shared/types";
import type { InterviewSetup, PlannedQuestion } from "./types";

export const RESUME_SKILL_QUESTIONS = 4;
export const RESUME_EXPERIENCE_QUESTIONS = 3;
const LIVE_RESUME_SKILL_QUESTIONS = 2;
const LIVE_RESUME_EXPERIENCE_QUESTIONS = 2;

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
          "Before we get into your resume, give me a concise overview of your background and the work you are doing now.",
          "Career narrative",
          "Learn the candidate's current scope and the thread they believe matters most.",
          ["a concise career story", "current responsibilities", "one relevant example"],
          "career",
          "about-you",
          true
        ),
        conversationalQuestion(
          role
            ? `At ${role.organization || "your current company"}, what were you personally responsible for as ${role.role || "part of the team"}, and what was the hardest problem you worked on?`
            : "What kind of work have you been doing most recently, and what has been the hardest problem?",
          role?.summary || "Current role",
          "Establish personal ownership, constraints, and impact in the candidate's recent work.",
          ["specific responsibility", "a difficult problem", "personal action or decision"],
          "current-role",
          "about-you"
        ),
        conversationalQuestion(
          project
            ? `Let's go deeper on ${project.name}. Walk me through the problem, the design you chose, a trade-off you made, and the result.`
            : "Choose one project you are proud of. Walk me through the problem, your design, a difficult trade-off, and the result.",
          project?.summary || "Project deep dive",
          "Test project ownership, technical judgement, and measurable outcomes.",
          ["problem and constraints", "candidate's design decision", "trade-off", "outcome"],
          "project",
          "your-work",
          true
        ),
        conversationalQuestion(
          "Tell me about a time a project did not go as planned. What happened, what did you do, and what changed afterward?",
          "Behavioural evidence",
          "Collect evidence of ownership, judgement, and learning under pressure.",
          ["specific situation", "personal action", "result", "lesson learned"],
          "behavioral",
          "how-you-work",
          true
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
  requiredForPacing = false
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
    intent,
    mustHit,
    maxFollowUps: 1,
    probeIfMissing: "What did you personally do, and what changed as a result?",
    pacingSection,
    requiredForPacing,
    estimatedDurationMs: 2.5 * 60 * 1000
  };
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

  const normalized = answer.trim().toLowerCase();
  const chosenIndex = question.options.findIndex(
    (option) => option.trim().toLowerCase() === normalized
  );
  if (chosenIndex === -1) return { correct: false, chosen: null };

  return {
    correct: chosenIndex === (question.answerIndex ?? 0),
    chosen: question.options[chosenIndex] ?? null
  };
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
