import type { ArchitectureDesignReviewArtifact } from "@/features/practice/architecture-design/domain/review-artifact-contracts";
import type { ArchitectureDesignQuestion } from "@/features/practice/architecture-design/domain/question-contracts";
import type { DsaQuestion } from "@/features/practice/dsa/domain/dsa";
import type { PlannedQuestion } from "./types";

/** Recency rotates content until the compatible catalogue is exhausted. */
export function rankDsaDesignScenarioWithFallback<TFocus, TSelection>(
  ranking: {
    rankFirstScenario: (
      focus: TFocus,
      context: { recentScenarioKeys?: string[]; recentTopicKeys?: string[] }
    ) => TSelection;
  },
  focus: TFocus,
  recentScenarioKeys: string[]
): TSelection {
  try {
    return ranking.rankFirstScenario(focus, { recentScenarioKeys });
  } catch {
    // Recency is a preference, not an availability gate. A second failure is
    // a genuine catalogue/configuration error and intentionally propagates.
    return ranking.rankFirstScenario(focus, { recentScenarioKeys: [] });
  }
}

/**
 * Creates the server-owned, frozen five-question plan for the permanent DSA
 * & Design round. The start route owns question/scenario selection; this pure
 * mapper only preserves that selection and keeps private design evidence in
 * interviewer guides.
 */
export function buildDsaDesignPlan(input: {
  dsaQuestions: readonly [DsaQuestion, DsaQuestion];
  designArtifact: ArchitectureDesignReviewArtifact;
}): PlannedQuestion[] {
  if (input.designArtifact.humanReview.status !== "approved") {
    throw new Error("DSA & Design rounds require a human-approved design artifact");
  }

  const sourceQuestions = [...input.designArtifact.questionBlock.questions].sort(
    (left, right) => left.order - right.order
  );
  const [requirements, contracts, architecture, operations] = sourceQuestions;
  if (!requirements || !contracts || !architecture || !operations) {
    throw new Error("DSA & Design rounds require four reviewed design source questions");
  }

  return [
    dsaQuestion(input.dsaQuestions[0], 1),
    dsaQuestion(input.dsaQuestions[1], 2),
    designQuestion({
      section: "frame",
      scenarioTitle: input.designArtifact.scenario.title,
      text: `Let’s frame ${input.designArtifact.scenario.title}. State the users, scope, non-goals, and scale assumptions that shape your design.`,
      sources: [requirements],
      competency: "Requirements and scale",
      mustHit: [
        "explicit scope and non-goals",
        "quantified scale assumptions",
        "measurable reliability goals"
      ],
      probeIfMissing:
        "Which quantified constraint changes your design most, and what guarantee follows from it?",
      stage: "rapid",
      requiredForPacing: true
    }),
    designQuestion({
      section: "design",
      scenarioTitle: input.designArtifact.scenario.title,
      text: "Now define the critical contracts, data and request flow, then defend the architecture, partitioning, and main trade-off.",
      sources: [contracts, architecture],
      competency: "Architecture and trade-offs",
      mustHit: [
        "stable identities and consistency boundary",
        "end-to-end data flow",
        "partitioning, async work, and defended trade-off"
      ],
      probeIfMissing:
        "Trace one request through the system and name the failure boundary your trade-off creates.",
      stage: "explain",
      requiredForPacing: true
    }),
    designQuestion({
      section: "defend",
      scenarioTitle: input.designArtifact.scenario.title,
      text: "Pressure-test the design: explain failure recovery, operational signals, security boundaries, and how you would evolve it safely.",
      sources: [operations],
      competency: "Reliability and evolution",
      mustHit: [
        "failure isolation and recovery",
        "observability and security boundaries",
        "reversible migration and rollback evidence"
      ],
      probeIfMissing:
        "How would you roll this out reversibly, and which threshold triggers rollback?",
      stage: "scenario",
      requiredForPacing: true
    })
  ];
}

function dsaQuestion(question: DsaQuestion, position: 1 | 2): PlannedQuestion {
  const statement = question.problemStatement ?? question.promptSummary;
  return {
    text: `Walk me through how you would solve ${question.title}.`,
    evidenceAnchor: question.title,
    kind: "code",
    interviewSection: "dsa",
    stage: "code",
    answerFormat: "typed",
    language: "",
    codeTask: `${question.title}: ${statement}`,
    codeSnippet: "",
    competency: position === 1 ? "Algorithmic reasoning" : patternLabel(question.primaryPattern),
    topicKey: `dsa:${question.primaryPattern}`,
    skillKeys: ["problem-solving"],
    rubricKeys: ["problem-solving"],
    intent: `Assess the candidate's approach, correctness, complexity, and edge-case reasoning for ${question.title}.`,
    mustHit: [
      "approach and data structure",
      "correctness argument",
      "time complexity",
      "space complexity",
      "important edge cases"
    ],
    probeIfMissing: question.followUpPrompts[0] ?? "What edge case would break a naive approach?",
    maxFollowUps: 1,
    requiredForPacing: position === 1,
    estimatedDurationMs: position === 1 ? 8 * 60_000 : 7 * 60_000,
    dsaInterviewerGuide: {
      concepts: [...question.conceptsTested],
      strongSignals: [...question.interviewSignals],
      commonMistakes: [...question.commonMistakes],
      followUpPrompts: [...question.followUpPrompts],
      edgeCases: [...(question.edgeCases ?? [])]
    }
  };
}

function designQuestion(input: {
  section: "frame" | "design" | "defend";
  scenarioTitle: string;
  text: string;
  sources: readonly ArchitectureDesignQuestion[];
  competency: string;
  mustHit: string[];
  probeIfMissing: string;
  stage: "rapid" | "explain" | "scenario";
  requiredForPacing: boolean;
}): PlannedQuestion {
  return {
    text: input.text,
    evidenceAnchor: publicEvidenceAnchor(input.scenarioTitle, input.sources),
    kind: "conversation",
    interviewSection: "design",
    stage: input.stage,
    answerFormat: "spoken",
    competency: input.competency,
    topicKey: "architecture-design",
    skillKeys: input.sources.flatMap((source) => source.topicKeys),
    rubricKeys: input.sources.flatMap((source) => source.dimensionKeys),
    intent: `Assess ${input.competency.toLowerCase()} against the frozen reviewed design scenario.`,
    mustHit: input.mustHit,
    probeIfMissing: input.probeIfMissing,
    maxFollowUps: 1,
    requiredForPacing: input.requiredForPacing,
    estimatedDurationMs: input.section === "frame" ? 5 * 60_000 : 6 * 60_000,
    storyPracticeInterviewerGuide: {
      practice: "architecture-design",
      label: "Architecture & Design",
      expectedAnswer: input.sources
        .map((source) => `${source.referenceAnswer.summary}\n${source.referenceAnswer.explanation}`)
        .join("\n\n"),
      rubric: input.sources.flatMap((source) =>
        source.rubric.map((item) => ({ criterion: item.criterion, points: item.points }))
      )
    }
  };
}

function publicEvidenceAnchor(
  scenarioTitle: string,
  sources: readonly ArchitectureDesignQuestion[]
): string {
  return [
    `Scenario: ${scenarioTitle}`,
    ...sources.map((source) => `${source.artifact.title}: ${source.artifact.content}`)
  ]
    .join("\n\n")
    .slice(0, 4_000);
}

function patternLabel(pattern: string): string {
  return pattern
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
