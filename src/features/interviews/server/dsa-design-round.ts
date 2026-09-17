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

/** New coding-only rounds use the same authored problem and interviewer evidence. */
export function buildDsaInterviewPlan(input: {
  dsaQuestions: readonly [DsaQuestion, DsaQuestion];
}): PlannedQuestion[] {
  return [dsaQuestion(input.dsaQuestions[0], 1), dsaQuestion(input.dsaQuestions[1], 2)];
}

/** New design-only rounds keep all reference material in private interviewer guides. */
export function buildSystemDesignPlan(input: {
  designArtifact: ArchitectureDesignReviewArtifact;
}): PlannedQuestion[] {
  return designQuestions(input.designArtifact);
}

/** Retained so already-created combined rounds remain reproducible and resumable. */
export function buildDsaDesignPlan(input: {
  dsaQuestions: readonly [DsaQuestion, DsaQuestion];
  designArtifact: ArchitectureDesignReviewArtifact;
}): PlannedQuestion[] {
  return [
    ...buildDsaInterviewPlan({ dsaQuestions: input.dsaQuestions }),
    ...buildSystemDesignPlan({ designArtifact: input.designArtifact })
  ];
}

function designQuestions(designArtifact: ArchitectureDesignReviewArtifact): PlannedQuestion[] {
  if (designArtifact.humanReview.status !== "approved") {
    throw new Error("System Design rounds require a human-approved design artifact");
  }

  const sourceQuestions = [...designArtifact.questionBlock.questions].sort(
    (left, right) => left.order - right.order
  );
  const [requirements, contracts, architecture, operations] = sourceQuestions;
  if (!requirements || !contracts || !architecture || !operations) {
    throw new Error("System Design rounds require four reviewed design source questions");
  }

  const scenarioPrompt = `${designArtifact.scenario.premise} Begin by asking me whatever you need to clarify before choosing components.`;
  const pressureTests = designArtifact.scenario.realismAnchors.slice(-2);

  return [
    designQuestion({
      section: "frame",
      scenarioTitle: designArtifact.scenario.title,
      text: scenarioPrompt,
      sources: [requirements],
      competency: "Requirements and scale",
      mustHit: [
        "explicit scope and non-goals",
        "quantified scale assumptions",
        "measurable reliability goals"
      ],
      probeIfMissing:
        "Which quantified constraint changes your design most, and what guarantee follows from it?",
      stage: "design-frame",
      requiredForPacing: true
    }),
    designQuestion({
      section: "design",
      scenarioTitle: designArtifact.scenario.title,
      text: "Using the requirements you established, build the architecture on the canvas. Talk through the main components, data flow, storage choices, asynchronous boundaries, and the most important trade-off.",
      sources: [contracts, architecture],
      competency: "Architecture and trade-offs",
      mustHit: [
        "stable identities and consistency boundary",
        "end-to-end data flow",
        "partitioning, async work, and defended trade-off"
      ],
      probeIfMissing:
        "Trace one request through the system and name the failure boundary your trade-off creates.",
      stage: "design-canvas",
      requiredForPacing: true
    }),
    designQuestion({
      section: "deep-dive",
      scenarioTitle: designArtifact.scenario.title,
      text: "Claire will select one component from your architecture. Trace that component’s contracts, state transitions, consistency boundary, idempotency, and recovery behavior end to end.",
      sources: [contracts, architecture],
      competency: "Technical depth",
      mustHit: [
        "component-specific contract and state",
        "consistency and idempotency boundary",
        "failure recovery grounded in the proposed design"
      ],
      probeIfMissing:
        "What durable identity or state transition prevents duplicate work at that boundary?",
      stage: "design-deep-dive",
      requiredForPacing: true
    }),
    designQuestion({
      section: "pressure",
      scenarioTitle: designArtifact.scenario.title,
      text: `Pressure test: ${pressureTests.join(" ")} Adapt your architecture and explain what changes, what degrades, and how the system recovers.`,
      sources: [architecture, operations],
      competency: "Scale and failure response",
      mustHit: [
        "identifies the first bottleneck or unsafe boundary",
        "adapts capacity and failure isolation",
        "preserves correctness while degrading gracefully"
      ],
      probeIfMissing:
        "Which part fails first under this change, and what mechanism contains the blast radius?",
      stage: "design-pressure",
      requiredForPacing: true
    }),
    designQuestion({
      section: "defend",
      scenarioTitle: designArtifact.scenario.title,
      text: "Finish by summarizing the design you would ship: its main trade-offs, operational signals, security boundaries, remaining risks, and the first improvement you would make with more time.",
      sources: [operations],
      competency: "Reliability and evolution",
      mustHit: [
        "failure isolation and recovery",
        "observability and security boundaries",
        "reversible migration and rollback evidence"
      ],
      probeIfMissing:
        "How would you roll this out reversibly, and which threshold triggers rollback?",
      stage: "design-defend",
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
    maxFollowUps: 2,
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
  section: "frame" | "design" | "deep-dive" | "pressure" | "defend";
  scenarioTitle: string;
  text: string;
  sources: readonly ArchitectureDesignQuestion[];
  competency: string;
  mustHit: string[];
  probeIfMissing: string;
  stage:
    "design-frame" | "design-canvas" | "design-deep-dive" | "design-pressure" | "design-defend";
  requiredForPacing: boolean;
}): PlannedQuestion {
  return {
    text: input.text,
    evidenceAnchor: input.scenarioTitle,
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
    maxFollowUps: input.section === "frame" || input.section === "design" ? 2 : 1,
    requiredForPacing: input.requiredForPacing,
    estimatedDurationMs:
      input.section === "frame"
        ? 4 * 60_000
        : input.section === "design"
          ? 7 * 60_000
          : input.section === "defend"
            ? 3 * 60_000
            : 4 * 60_000,
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

function patternLabel(pattern: string): string {
  return pattern
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
