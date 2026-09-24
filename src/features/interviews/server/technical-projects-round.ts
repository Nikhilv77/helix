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
import { aiMlPracticeSession } from "@/features/practice/ai-ml/domain/ai-ml-practice";

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
  targetRole?: CandidateProfile["targetRole"];
  count?: number;
}): ReviewedTechnicalMcq[] {
  const count = input.count ?? 3;
  const isAiMl = input.targetRole === "ai-ml" || isAiMlBlueprint(input.coreBlueprint);
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
  const fallback = isAiMl
    ? aiMlTechnicalQuestions()
    : buildFundamentalsPlan(input.level, { shuffle: (items) => items })
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
          explanation:
            question.explanation ?? "The authored answer follows the described mechanism.",
          strongSignals: [...question.mustHit]
        }));

  const seen = new Set<string>();
  const candidates = [...kitQuestions, ...fallback];
  return candidates
    .filter((question) => {
      const fingerprint = normalizeKey(question.prompt);
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    })
    .slice(0, count);
}

function isAiMlBlueprint(blueprint: SessionBlueprint): boolean {
  const signal = [
    blueprint.title,
    blueprint.subtitle,
    ...blueprint.topics.flatMap((topic) => [topic.key, topic.label, ...topic.skillKeys])
  ]
    .join(" ")
    .toLowerCase();
  return /\b(?:ai|ml|llm|rag|machine-learning|pytorch|tensorflow)\b/.test(signal);
}

function aiMlTechnicalQuestions(): ReviewedTechnicalMcq[] {
  return aiMlPracticeSession("core-technical").questions.map((source, index) => {
    const answerIndex = Math.max(
      0,
      source.options.findIndex((option) => option.id === source.correctOptionId)
    );
    return {
      sourceId: `ai-ml-core:${index + 1}`,
      sourceVersion: 2,
      topicKey: "ai-ml-core-technical",
      skillKeys: ["ai-ml", "model-evaluation"],
      prompt: source.prompt,
      options: source.options.map((option) => option.label),
      answerIndex,
      explanation: source.explanation,
      strongSignals: [
        "identifies the relevant model or data boundary",
        "uses measurable evidence",
        "connects the decision to production impact"
      ]
    };
  });
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
  targetRole?: CandidateProfile["targetRole"];
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

  const projectQuestions = [
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
    })
  ];
  const finalScenario =
    input.targetRole === "ai-ml"
      ? projectQuestion(input.project, {
          act: "failure",
          text: `Pressure-test ${input.project.name} as an AI/ML system: imagine a model release lowers task success for one user segment. How would you distinguish a data, model, retrieval, or serving regression, contain the impact, and verify the fix? Treat this as a hypothetical incident unless you actually handled one.`,
          competency: "Applied AI production diagnosis",
          mustHit: [
            "segment-level evidence and a control comparison",
            "competing data, model, retrieval, and serving hypotheses",
            "safe mitigation and outcome-based verification"
          ],
          probe: "Which slice and control would show whether the model release caused the drop?",
          parameters: ["technical-reasoning", "practical-execution", "tradeoffs", "communication"],
          durationMs: 8 * 60_000
        })
      : projectQuestion(input.project, {
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
        });

  return [
    ...input.mcqs.slice(0, 3).map(toPlannedMcq),
    ...projectQuestions,
    finalScenario,
    projectCodingQuestion(input.project, input.codingTask, input.targetRole)
  ];
}

function projectCodingQuestion(
  project: GroundedProjectInterviewSource,
  codingTask: ResumeCodingTask | null | undefined,
  targetRole?: CandidateProfile["targetRole"]
): PlannedQuestion {
  const projectCodingTask = codingTaskForProject(project, codingTask);
  const relevantCodingTask =
    targetRole === "ai-ml" &&
    projectCodingTask &&
    !supportedCodingLanguage(projectCodingTask.language)
      ? null
      : projectCodingTask;
  const language = relevantCodingTask?.language || projectLanguage(project.skillKeys, targetRole);
  const aiMlFallback = targetRole === "ai-ml" ? fallbackAiMlCodeTask(project) : null;
  const task =
    relevantCodingTask?.brief?.trim() || (aiMlFallback?.brief ?? fallbackProjectCodeTask(project));
  const expects =
    relevantCodingTask?.expects?.filter(Boolean).slice(0, 3) ?? aiMlFallback?.expects ?? [];
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

function projectLanguage(
  skillKeys: readonly string[],
  targetRole?: CandidateProfile["targetRole"]
): string {
  const skills = skillKeys.map(normalizeKey);
  if (
    skillKeys.some((skill) => /c\+\+|\bcuda\b/i.test(skill)) ||
    skills.includes("cpp") ||
    skills.includes("c-plus-plus")
  )
    return "cpp";
  if (skills.some((skill) => skill === "python" || skill === "pytorch" || skill === "django"))
    return "python";
  if (skills.some((skill) => skill === "java" || skill === "spring")) return "java";
  if (skills.some((skill) => skill === "typescript" || skill === "ts")) return "typescript";
  if (skills.some((skill) => skill === "javascript" || skill === "nodejs" || skill === "node-js"))
    return "javascript";
  return targetRole === "ai-ml" ? "python" : "typescript";
}

function supportedCodingLanguage(language: string): boolean {
  return ["python", "javascript", "typescript", "java", "cpp"].includes(
    language.trim().toLowerCase()
  );
}

function fallbackAiMlCodeTask(project: GroundedProjectInterviewSource): {
  brief: string;
  expects: string[];
} {
  const evidence = [project.name, project.summary, ...project.skillKeys].join(" ").toLowerCase();
  const task = /\b(?:rag|retriev\w*|search\w*|embedding\w*|vector\w*|index\w*)\b/.test(evidence)
    ? {
        brief:
          "Given candidate passages with tenantId, documentId, score, and deleted fields, return the top k unique documents for one tenant. Exclude deleted passages and reject an invalid k.",
        expects: [
          "tenant and deletion filtering",
          "stable score ordering with document deduplication",
          "tests for invalid limits and cross-tenant records"
        ]
      }
    : /\b(?:vision|image\w*|visual|ocr|detect\w*|camera)\b/.test(evidence)
      ? {
          brief:
            "Given image detections with imageId, label, and confidence, group accepted detections by image and return image IDs needing review below a configurable confidence threshold. Reject malformed confidence values.",
          expects: [
            "correct threshold and image grouping",
            "review routing for uncertain detections",
            "tests for empty and malformed inputs"
          ]
        }
      : /\b(?:llm|language|nlp|prompt\w*|generat\w*|chatbot|text)\b/.test(evidence)
        ? {
            brief:
              "Given response records with promptVersion, grounded, and latencyMs fields, calculate the grounding pass rate and worst latency for each prompt version. Reject malformed records and keep versions separate.",
            expects: [
              "per-version quality and latency aggregation",
              "validation of missing or invalid fields",
              "tests for empty and mixed-version inputs"
            ]
          }
        : /\b(?:reinforcement|policy|reward|agent|simulation)\b/.test(evidence)
          ? {
              brief:
                "Given episodes with policyId, reward, and steps, compute mean reward and total steps per policy and flag policies below a configurable reward threshold. Handle empty input and invalid numeric values.",
              expects: [
                "correct per-policy aggregation",
                "threshold behavior and invalid-value handling",
                "tests for empty and mixed-policy episodes"
              ]
            }
          : /\b(?:mlops|serving|inference|deploy\w*|pipeline|monitor\w*|feature.store)\b/.test(evidence)
            ? {
                brief:
                  "Given model release events with eventId, modelVersion, status, and timestamp, deduplicate retried events and return the latest status for each model version. Reject malformed events and make ties deterministic.",
                expects: [
                  "idempotent event deduplication",
                  "correct latest status with deterministic ties",
                  "tests for retries and malformed events"
                ]
              }
            : {
                brief:
                  "Given prediction records with segment, predictedLabel, and actualLabel, return overall accuracy and accuracy by segment, and identify segments below a configurable quality threshold. Reject malformed records.",
                expects: [
                  "validated records and empty input handling",
                  "overall and per-segment accuracy",
                  "tests for malformed and regressing segments"
                ]
              };
  return {
    ...task,
    brief: `${task.brief} Use ${project.name} as context; treat the record shape as an interview assumption, not a claim about the original project. Add focused tests. Saved project context: ${project.summary}`
  };
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
