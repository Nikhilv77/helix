import type { CandidateResume, ResumeInterviewKit } from "@/lib/shared/types";
import type { InterviewSetup, PlannedQuestion } from "./types";

export const RESUME_SKILL_QUESTIONS = 4;
export const RESUME_EXPERIENCE_QUESTIONS = 3;

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
  options: { shuffle?: <T>(items: T[]) => T[] } = {}
): PlannedQuestion[] {
  const shuffle = options.shuffle ?? shuffleInPlace;

  // Skills are drawn at random so the same resume does not produce the same
  // round twice, while each stage keeps its fixed position in the arc.
  const skills = shuffle([...kit.skillQuestions]).slice(0, RESUME_SKILL_QUESTIONS);
  const experience = kit.experienceQuestions.slice(0, RESUME_EXPERIENCE_QUESTIONS);

  const skillQuestions: PlannedQuestion[] = skills.map((question) => ({
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
    probeIfMissing: `Where exactly did you use ${question.skill || "that"} in your own work?`
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
          probeIfMissing: "Walk me through what your version does, line by line."
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
    probeIfMissing:
      question.probeIfMissing || "Which part would not have happened without your contribution?"
  }));

  return [...skillQuestions, ...codeQuestions, ...experienceQuestions];
}

/** The spoken opener, so the candidate knows how the round is laid out. */
export function resumeRoundContext(resume: CandidateResume, kit: ResumeInterviewKit): string {
  const skills = kit.skillQuestions.map((question) => question.skill).filter(Boolean);

  return [
    "This is a resume and behavioural round in three stages: skills the candidate claims, one small coding task, then their actual work experience.",
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

  return { correct: chosenIndex === (question.answerIndex ?? 0), chosen: question.options[chosenIndex] ?? null };
}

/** What Maya says after grading, in place of a decision call. */
export function multipleChoiceReply(question: PlannedQuestion, correct: boolean): string {
  const explanation = question.explanation?.trim();

  if (correct) {
    return explanation ? `That's right. ${explanation}` : "That's right.";
  }

  const answer = question.options?.[question.answerIndex ?? 0];
  if (!answer) return "Not quite, but let's keep going.";

  return explanation
    ? `Not quite — it's ${answer}. ${explanation}`
    : `Not quite — it's ${answer}.`;
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
