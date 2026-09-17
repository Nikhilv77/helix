import type { SessionBlueprint } from "@/features/interviews/domain/personalized-plan";
import type {
  CandidateProfile,
  Level,
  ResumeCodingTask,
  ResumeInterviewKit,
  ResumeSkillQuestion
} from "@/lib/shared/types";
import { buildFundamentalsPlan } from "./fundamentals-round";
import type { PlannedQuestion } from "./types";

export interface ReviewedTechnicalMcq {
  sourceId: string;
  sourceVersion: number;
  topicKey: string;
  skillKeys: string[];
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  strongSignals: string[];
}

export interface GroundedProjectInterviewSource {
  sourceKind: "project" | "work-experience" | "scenario";
  sourceId: string;
  name: string;
  roleLabel: string | null;
  summary: string;
  outcome: string | null;
  skillKeys: string[];
}

const TECHNICAL_PARAMETERS = ["concept-depth", "technical-reasoning"];

/**
 * Reuses the frozen resume-kit checks, then fills a thin kit from the authored
 * fundamentals bank. Nothing is generated while the interview is starting.
 */
export function selectTechnicalProjectMcqs(input: {
  kit: ResumeInterviewKit | null | undefined;
  coreBlueprint: SessionBlueprint;
  level: Level | null;
  count?: number;
}): ReviewedTechnicalMcq[] {
  const count = input.count ?? 3;
  const allowedSkills = new Set(
    input.coreBlueprint.topics.flatMap((topic) => topic.skillKeys.map(normalizeKey))
  );
  const kitQuestions = (input.kit?.skillQuestions ?? [])
    .filter(validKitMcq)
    .sort((left, right) => {
      const leftMatch = allowedSkills.has(normalizeKey(left.skill)) ? 1 : 0;
      const rightMatch = allowedSkills.has(normalizeKey(right.skill)) ? 1 : 0;
      return rightMatch - leftMatch;
    })
    .map((question, index) => kitMcq(question, index));
  const fallback = buildFundamentalsPlan(input.level, { shuffle: (items) => items })
    .filter(
      (question): question is PlannedQuestion & { options: string[]; answerIndex: number } =>
        question.kind === "mcq" &&
        Boolean(question.options?.length) &&
        typeof question.answerIndex === "number"
    )
    .map((question) => ({
      sourceId: `fundamentals:${question.sourceSlug ?? normalizeKey(question.text)}`,
      sourceVersion: 1,
      topicKey: question.sourceSlug ?? normalizeKey(question.competency ?? "fundamentals"),
      skillKeys: [normalizeKey(question.skill ?? question.competency ?? "fundamentals")],
      prompt: question.text,
      options: [...question.options],
      answerIndex: question.answerIndex,
      explanation: question.explanation ?? "The authored answer follows the described mechanism.",
      strongSignals: [...question.mustHit]
    }));

  const seen = new Set<string>();
  return [...kitQuestions, ...fallback]
    .filter((question) => {
      const fingerprint = normalizeKey(question.prompt);
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    })
    .slice(0, count);
}

/** Chooses one resume-grounded project/work item, with an explicit scenario fallback. */
export function selectGroundedProjectSource(input: {
  profile: CandidateProfile;
  coreBlueprint: SessionBlueprint;
  appliedBlueprint: SessionBlueprint;
}): GroundedProjectInterviewSource {
  const targetSkills = new Set(
    [...input.coreBlueprint.topics, ...input.appliedBlueprint.topics].flatMap((topic) =>
      topic.skillKeys.map(normalizeKey)
    )
  );
  const projects = [...(input.profile.resume?.projects ?? [])]
    .map((project, index) => ({ project, index, score: overlap(project.skills, targetSkills) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selectedProject = projects[0];
  if (selectedProject) {
    const { project, index } = selectedProject;
    return {
      sourceKind: "project",
      sourceId: `resume-project-${index + 1}`,
      name: project.name || `Project ${index + 1}`,
      roleLabel: null,
      summary: project.summary || project.outcome || "Resume-backed project",
      outcome: project.outcome.trim() || null,
      skillKeys: project.skills.map(normalizeKey).filter(Boolean)
    };
  }

  const experience = input.profile.resume?.experience[0];
  if (experience) {
    return {
      sourceKind: "work-experience",
      sourceId: "resume-experience-1",
      name: experience.organization || experience.role || "Recent work",
      roleLabel: experience.role || null,
      summary: experience.summary || experience.achievements[0] || "Resume-backed work experience",
      outcome: experience.achievements[0] ?? null,
      skillKeys: experience.skills.map(normalizeKey).filter(Boolean)
    };
  }

  const topic = input.appliedBlueprint.topics[0];
  return {
    sourceKind: "scenario",
    sourceId: `blueprint-scenario:${topic?.key ?? "applied-engineering"}`,
    name: topic?.label ?? "Production engineering scenario",
    roleLabel: null,
    summary:
      topic?.objectives[0] ?? "Work through a reviewed, role-compatible production scenario.",
    outcome: null,
    skillKeys: topic?.skillKeys.map(normalizeKey) ?? []
  };
}

export function buildTechnicalProjectsPlan(input: {
  coreBlueprint: SessionBlueprint;
  appliedBlueprint: SessionBlueprint;
  mcqs: readonly ReviewedTechnicalMcq[];
  project: GroundedProjectInterviewSource;
  codingTask?: ResumeCodingTask | null;
}): PlannedQuestion[] {
  if (input.coreBlueprint.kind !== "core-technical") {
    throw new Error("Core Technical & Projects requires a Core Technical blueprint");
  }
  if (input.appliedBlueprint.kind !== "applied-engineering") {
    throw new Error("Core Technical & Projects requires an Applied Engineering blueprint");
  }
  if (input.mcqs.length < 3) {
    throw new Error("Core Technical & Projects requires three reviewed technical MCQs");
  }

  return [
    ...input.mcqs.slice(0, 3).map(toPlannedMcq),
    projectQuestion(input.project, {
      act: "context",
      text:
        input.project.sourceKind === "scenario"
          ? `Let's use ${input.project.name} as a production scenario. Clarify the problem, constraints, and responsibility you would take first.`
          : `Let's focus on ${input.project.name}. Set the context, the important constraint, and exactly what you personally owned.`,
      competency: "Project ownership",
      mustHit: ["problem and constraints", "personal scope", "success condition"],
      probe: "Which part of that work would not have happened without your contribution?",
      parameters:
        input.project.sourceKind === "scenario"
          ? ["communication"]
          : ["project-ownership", "communication"],
      durationMs: 5 * 60_000
    }),
    projectQuestion(input.project, {
      act: "mechanism",
      text: `Trace the most important technical path in ${input.project.name} from input to outcome, and explain why it behaves that way.`,
      competency: "Technical mechanism",
      mustHit: ["end-to-end flow", "state and ownership boundary", "mechanism-level reasoning"],
      probe: "At which exact boundary does ownership or state change?",
      parameters: ["concept-depth", "technical-reasoning", "practical-execution", "communication"],
      durationMs: 8 * 60_000
    }),
    projectQuestion(input.project, {
      act: "failure",
      text: `Pressure-test that path: choose a real failure you handled, or a clearly hypothetical one, and show how you would prove the cause.`,
      competency: "Debugging and verification",
      mustHit: [
        "evidence and competing hypotheses",
        "root cause",
        "repair and regression protection"
      ],
      probe: "What evidence would have disproved your leading diagnosis?",
      parameters: [
        "technical-reasoning",
        "practical-execution",
        "project-ownership",
        "communication"
      ],
      durationMs: 8 * 60_000
    }),
    projectCodingQuestion(input.project, input.codingTask)
  ];
}

function projectCodingQuestion(
  project: GroundedProjectInterviewSource,
  codingTask: ResumeCodingTask | null | undefined
): PlannedQuestion {
  const relevantCodingTask = codingTaskForProject(project, codingTask);
  const language = relevantCodingTask?.language || projectLanguage(project.skillKeys);
  const task = relevantCodingTask?.brief?.trim() || fallbackProjectCodeTask(project);
  const expects = relevantCodingTask?.expects?.filter(Boolean).slice(0, 3) ?? [];
  const groundedFacts = [project.summary, project.outcome].filter((value): value is string =>
    Boolean(value?.trim())
  );

  return {
    text: `Let's finish with a coding task grounded in ${project.name}${relevantCodingTask?.title ? `: ${relevantCodingTask.title}` : "."}`,
    evidenceAnchor: `${project.name}: ${project.summary}`.slice(0, 4_000),
    kind: "code",
    stage: "code",
    technicalProjectsSection: "project-deep-dive",
    projectAct: "coding",
    answerFormat: "typed",
    language,
    codeTask: `${task}\n\nConnect the implementation to ${project.name}. State any project detail you need to assume rather than inventing it.`,
    codeSnippet: relevantCodingTask?.starterCode?.trim() || starterCode(language),
    competency: "Project-grounded implementation",
    topicKey: `project:${project.sourceId}`,
    skillKeys: [...project.skillKeys],
    evaluationParameterKeys: [
      "technical-reasoning",
      "tradeoffs",
      "practical-execution",
      "project-ownership"
    ],
    intent: "Verify that the candidate can turn their project understanding into working code.",
    mustHit:
      expects.length > 0
        ? expects
        : [
            "a coherent project-specific rule",
            "input and failure handling",
            "focused examples or tests"
          ],
    probeIfMissing:
      "Which project constraint does this implementation protect, and how would you test it?",
    maxFollowUps: 1,
    pacingSection: "project-deep-dive",
    requiredForPacing: true,
    estimatedDurationMs: 7 * 60_000,
    technicalProjectInterviewerGuide: {
      sourceKind: project.sourceKind,
      sourceId: project.sourceId,
      groundedFacts,
      allowedSkillKeys: [...project.skillKeys],
      strongSignals:
        expects.length > 0
          ? expects
          : ["project-specific assumption", "correct boundary handling", "verification examples"],
      contradictionChecks: [
        "Do not treat an assumption in the coding task as a historical project fact.",
        "Challenge only behavior that contradicts the submitted code or the candidate's stated assumption."
      ],
      rubric: (expects.length > 0
        ? expects
        : ["project-specific assumption", "correct boundary handling", "verification examples"]
      ).map((criterion, index) => ({ criterion, points: index === 0 ? 4 : 3 }))
    }
  };
}

function codingTaskForProject(
  project: GroundedProjectInterviewSource,
  codingTask: ResumeCodingTask | null | undefined
): ResumeCodingTask | null {
  if (!codingTask?.brief.trim()) return null;
  const projectSkills = new Set(project.skillKeys.map(normalizeKey));
  return projectSkills.has(normalizeKey(codingTask.skill)) ? codingTask : null;
}

function projectLanguage(skillKeys: readonly string[]): string {
  const skills = skillKeys.map(normalizeKey);
  if (skills.some((skill) => skill === "python" || skill === "pytorch" || skill === "django"))
    return "python";
  if (skills.some((skill) => skill === "java" || skill === "spring")) return "java";
  if (skills.some((skill) => skill === "cpp" || skill === "c-plus-plus")) return "cpp";
  if (skills.some((skill) => skill === "javascript" || skill === "nodejs" || skill === "node-js"))
    return "javascript";
  return "typescript";
}

function fallbackProjectCodeTask(project: GroundedProjectInterviewSource): string {
  return `Implement one small, self-contained rule or data transformation that belongs at an important boundary in ${project.name}. Define clear inputs and outputs, handle invalid input and a duplicate or retry case, and add two focused examples or tests. The saved project context is: ${project.summary}`;
}

function starterCode(language: string): string {
  if (language === "python") {
    return `def apply_project_rule(value):\n    # State the project-specific assumption, then implement the rule.\n    raise NotImplementedError\n\n# Add two focused examples or tests.`;
  }
  if (language === "java") {
    return `class Solution {\n    static Object applyProjectRule(Object value) {\n        // State the project-specific assumption, then implement the rule.\n        throw new UnsupportedOperationException("Not implemented");\n    }\n\n    public static void main(String[] args) {\n        // Add two focused examples or tests.\n    }\n}`;
  }
  if (language === "cpp") {
    return `#include <iostream>\n#include <stdexcept>\n\nint applyProjectRule(int value) {\n    // State the project-specific assumption, then implement the rule.\n    throw std::runtime_error("Not implemented");\n}\n\nint main() {\n    // Add two focused examples or tests.\n}`;
  }
  const declaration = language === "typescript" ? "export function" : "function";
  return `${declaration} applyProjectRule(value${language === "typescript" ? ": unknown" : ""})${language === "typescript" ? ": unknown" : ""} {\n  // State the project-specific assumption, then implement the rule.\n  throw new Error("Not implemented");\n}\n\n// Add two focused examples or tests.`;
}

function toPlannedMcq(question: ReviewedTechnicalMcq, index: number): PlannedQuestion {
  return {
    text: question.prompt,
    evidenceAnchor: question.topicKey,
    kind: "mcq",
    stage: "rapid",
    technicalProjectsSection: "technical-calibration",
    options: [...question.options],
    answerIndex: question.answerIndex,
    explanation: question.explanation,
    answerFormat: "mcq",
    sourceSlug: question.sourceId,
    competency: "Core technical reasoning",
    topicKey: question.topicKey,
    skillKeys: [...question.skillKeys],
    evaluationParameterKeys: [...TECHNICAL_PARAMETERS],
    intent: "Test a mechanism-level technical decision without relying on terminology recall.",
    mustHit: question.strongSignals.slice(0, 3),
    probeIfMissing: "Choose the option that best matches the underlying mechanism.",
    maxFollowUps: 0,
    pacingSection: "technical-calibration",
    requiredForPacing: index === 0,
    estimatedDurationMs: 90_000
  };
}

function projectQuestion(
  project: GroundedProjectInterviewSource,
  input: {
    act: NonNullable<PlannedQuestion["projectAct"]>;
    text: string;
    competency: string;
    mustHit: string[];
    probe: string;
    parameters: string[];
    durationMs: number;
  }
): PlannedQuestion {
  const groundedFacts = [project.summary, project.outcome].filter((value): value is string =>
    Boolean(value?.trim())
  );
  return {
    text: input.text,
    evidenceAnchor: `${project.name}: ${project.summary}`.slice(0, 4_000),
    kind: "conversation",
    stage: input.act === "context" || input.act === "mechanism" ? "project" : "scenario",
    technicalProjectsSection: "project-deep-dive",
    projectAct: input.act,
    answerFormat: "spoken",
    competency: input.competency,
    topicKey: `project:${project.sourceId}`,
    skillKeys: [...project.skillKeys],
    evaluationParameterKeys: [...input.parameters],
    intent: `Assess ${input.competency.toLowerCase()} using one grounded project source.`,
    mustHit: input.mustHit,
    probeIfMissing: input.probe,
    maxFollowUps: 2,
    pacingSection: "project-deep-dive",
    requiredForPacing: true,
    estimatedDurationMs: input.durationMs,
    technicalProjectInterviewerGuide: {
      sourceKind: project.sourceKind,
      sourceId: project.sourceId,
      groundedFacts,
      allowedSkillKeys: [...project.skillKeys],
      strongSignals: input.mustHit,
      contradictionChecks: [
        "Separate the candidate's work from team work.",
        "Challenge a claimed guarantee that lacks a mechanism or verification path."
      ],
      rubric: input.mustHit.map((criterion, index) => ({
        criterion,
        points: index === 0 ? 4 : 3
      }))
    }
  };
}

function validKitMcq(question: ResumeSkillQuestion): boolean {
  return (
    question.format === "mcq" &&
    question.options.length >= 3 &&
    question.answerIndex >= 0 &&
    question.answerIndex < question.options.length &&
    Boolean(question.prompt.trim()) &&
    Boolean(question.explanation.trim())
  );
}

function kitMcq(question: ResumeSkillQuestion, index: number): ReviewedTechnicalMcq {
  return {
    sourceId: `resume-kit:${normalizeKey(question.skill)}:${index + 1}`,
    sourceVersion: 2,
    topicKey: normalizeKey(question.skill) || `resume-skill-${index + 1}`,
    skillKeys: [normalizeKey(question.skill)].filter(Boolean),
    prompt: question.prompt,
    options: [...question.options],
    answerIndex: question.answerIndex,
    explanation: question.explanation,
    strongSignals: question.expects.length
      ? [...question.expects]
      : ["the underlying mechanism", "the resulting engineering consequence"]
  };
}

function overlap(values: string[], targets: Set<string>): number {
  return values.reduce((score, value) => score + (targets.has(normalizeKey(value)) ? 1 : 0), 0);
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
