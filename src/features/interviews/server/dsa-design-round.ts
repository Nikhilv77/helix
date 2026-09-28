import type { ArchitectureDesignReviewArtifact } from "@/features/practice/architecture-design/domain/review-artifact-contracts";
import type { ArchitectureDesignQuestion } from "@/features/practice/architecture-design/domain/question-contracts";
import {
  architectureDesignTrackForRole,
  type ArchitectureDesignTrack
} from "@/features/practice/architecture-design/domain/contracts";
import type { DsaQuestion } from "@/features/practice/dsa/domain/dsa";
import type { PlannedQuestion } from "./types";

/**
 * Recency rotates content until the compatible catalogue is exhausted. Each
 * exclusion list is tried in order, from the most to the least selective,
 * before recency is dropped altogether.
 */
export function rankDsaDesignScenarioWithFallback<TFocus, TSelection>(
  ranking: {
    rankFirstScenario: (
      focus: TFocus,
      context: { recentScenarioKeys?: string[]; recentTopicKeys?: string[] }
    ) => TSelection;
  },
  focus: TFocus,
  recentScenarioKeys: string[],
  ...fallbackRecentScenarioKeys: string[][]
): TSelection {
  for (const keys of [recentScenarioKeys, ...fallbackRecentScenarioKeys]) {
    if (!keys.length) continue;
    try {
      return ranking.rankFirstScenario(focus, { recentScenarioKeys: keys });
    } catch {
      // Too selective for the compatible catalogue; try the next list.
    }
  }
  // Recency is a preference, not an availability gate. A final failure is
  // a genuine catalogue/configuration error and intentionally propagates.
  return ranking.rankFirstScenario(focus, { recentScenarioKeys: [] });
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
  /** Frontend rounds design the client, data rounds the pipeline; others the servers. */
  role?: string | null;
}): PlannedQuestion[] {
  return designQuestions(
    input.designArtifact,
    ACTS_BY_TRACK[architectureDesignTrackForRole(input.role)]
  );
}

type DesignActCopy = {
  text?: string;
  mustHit: string[];
  probeIfMissing: string;
};

/** The five acts' wording for server-side system design. */
const SERVER_ACTS: Record<"frame" | "design" | "deep-dive" | "pressure" | "defend", DesignActCopy> =
  {
    frame: {
      mustHit: [
        "explicit scope and non-goals",
        "quantified scale assumptions",
        "measurable reliability goals"
      ],
      probeIfMissing:
        "Which quantified constraint changes your design most, and what guarantee follows from it?"
    },
    design: {
      text: "Using the requirements you established, build the architecture on the canvas. Talk through the main components, data flow, storage choices, asynchronous boundaries, and the most important trade-off.",
      mustHit: [
        "stable identities and consistency boundary",
        "end-to-end data flow",
        "partitioning, async work, and defended trade-off"
      ],
      probeIfMissing:
        "Trace one request through the system and name the failure boundary your trade-off creates."
    },
    "deep-dive": {
      text: "Claire will select one component from your architecture. Trace that component’s contracts, state transitions, consistency boundary, idempotency, and recovery behavior end to end.",
      mustHit: [
        "component-specific contract and state",
        "consistency and idempotency boundary",
        "failure recovery grounded in the proposed design"
      ],
      probeIfMissing:
        "What durable identity or state transition prevents duplicate work at that boundary?"
    },
    pressure: {
      text: "Adapt your architecture and explain what changes, what degrades, and how the system recovers.",
      mustHit: [
        "identifies the first bottleneck or unsafe boundary",
        "adapts capacity and failure isolation",
        "preserves correctness while degrading gracefully"
      ],
      probeIfMissing:
        "Which part fails first under this change, and what mechanism contains the blast radius?"
    },
    defend: {
      text: "Finish by summarizing the design you would ship: its main trade-offs, operational signals, security boundaries, remaining risks, and the first improvement you would make with more time.",
      mustHit: [
        "failure isolation and recovery",
        "observability and security boundaries",
        "reversible migration and rollback evidence"
      ],
      probeIfMissing:
        "How would you roll this out reversibly, and which threshold triggers rollback?"
    }
  };

/**
 * Frontend system design: the browser client is the system. The acts keep the
 * same shape, but ask about components, state, data fetching, rendering, real
 * devices and networks, accessibility, and the API contract with the backend.
 */
const FRONTEND_ACTS: Record<keyof typeof SERVER_ACTS, DesignActCopy> = {
  frame: {
    mustHit: [
      "explicit scope and non-goals",
      "users, devices, networks, and data-size assumptions",
      "measurable performance and accessibility goals"
    ],
    probeIfMissing:
      "Which device, network, or data-size assumption changes your client design most, and what target follows from it?"
  },
  design: {
    text: "Using the requirements you established, sketch the client architecture on the canvas. Talk through the component tree and where state lives, how data is fetched, cached, and kept fresh, what renders on the server versus in the browser, the API contract you need from the backend, and your most important trade-off.",
    mustHit: [
      "component boundaries and state ownership",
      "data fetching, caching, and the API contract",
      "rendering strategy and a defended trade-off"
    ],
    probeIfMissing:
      "Walk me through what happens from the user's action to the updated screen, and where the state for it lives."
  },
  "deep-dive": {
    text: "Claire will select one part of your client design. Trace its state and data flow end to end, including loading, empty, and error states, what happens on a slow or failed network, and how it stays consistent with the server when requests race or retry.",
    mustHit: [
      "component-specific state and data flow",
      "loading, empty, and error states",
      "consistency with the server under races and retries"
    ],
    probeIfMissing:
      "If two requests for this component finish out of order, what does the user see, and how do you prevent the wrong one from winning?"
  },
  pressure: {
    text: "Adapt your client design and explain what the user sees, what degrades, and how the interface recovers.",
    mustHit: [
      "identifies the first user-visible bottleneck or failure",
      "adapts rendering, caching, or network strategy",
      "keeps the interface correct, usable, and accessible while degraded"
    ],
    probeIfMissing:
      "What does the user notice first under this change, and what in your client design contains it?"
  },
  defend: {
    text: "Finish by summarizing the frontend you would ship: its main trade-offs, what you would measure in real users (Core Web Vitals and errors), security and accessibility boundaries, remaining risks, how you would roll it out and roll it back, and the first improvement you would make with more time.",
    mustHit: [
      "performance and accessibility commitments",
      "real-user monitoring and security boundaries",
      "flagged rollout and rollback"
    ],
    probeIfMissing:
      "How would you roll this out safely, and which real-user metric would make you roll it back?"
  }
};

/**
 * Data system design: pipelines and tables are the system. The acts ask about
 * data contracts, table layout, late and duplicate data, idempotent writes,
 * skew, freshness and quality, and safe backfills.
 */
const DATA_ACTS: Record<keyof typeof SERVER_ACTS, DesignActCopy> = {
  frame: {
    mustHit: [
      "explicit consumers, scope, and non-goals",
      "quantified volume, late-data, and growth assumptions",
      "measurable freshness, completeness, and correctness goals"
    ],
    probeIfMissing:
      "Which volume or late-data assumption changes your pipeline most, and what freshness or completeness target follows from it?"
  },
  design: {
    text: "Using the requirements you established, sketch the pipeline on the canvas. Talk through the sources and data contracts, ingestion, stream and batch stages, how tables are modelled and partitioned, where duplicates and late data are handled, what consumers read, and your most important trade-off.",
    mustHit: [
      "data contracts and stable record identity",
      "end-to-end flow with table models and partitioning",
      "late and duplicate data handling and a defended trade-off"
    ],
    probeIfMissing:
      "Follow one record from its source to the table that serves it, and tell me where a duplicate of it would be removed."
  },
  "deep-dive": {
    text: "Claire will select one stage of your pipeline. Trace its inputs and outputs, the state it keeps, how it stays idempotent on retries and replays, how it handles late or bad records, and how it recovers after a failure.",
    mustHit: [
      "stage-specific inputs, outputs, and state",
      "idempotent writes on retries and replays",
      "late, bad, and failed-record handling with recovery"
    ],
    probeIfMissing:
      "If this stage restarts and processes the last hour again, what stops the output from being counted twice?"
  },
  pressure: {
    text: "Adapt your pipeline and explain what falls behind or breaks first, what consumers see, and how the data is corrected afterwards.",
    mustHit: [
      "identifies the first bottleneck, skew, or correctness risk",
      "adapts partitioning, scaling, or reprocessing",
      "keeps published data correct or clearly labelled while degraded"
    ],
    probeIfMissing:
      "What do the people reading these tables see first under this change, and how do you restate the data once it recovers?"
  },
  defend: {
    text: "Finish by summarizing the pipeline you would ship: its main trade-offs, the freshness, completeness, and quality checks you would alert on, how personal data is protected and deleted, what it costs, remaining risks, how you would migrate or backfill with parallel runs and rollback, and the first improvement you would make with more time.",
    mustHit: [
      "freshness, completeness, and quality monitoring",
      "privacy, access, and cost boundaries",
      "backfill or migration with parallel runs and rollback"
    ],
    probeIfMissing:
      "How would you move consumers onto this pipeline safely, and which difference between old and new numbers would stop you?"
  }
};

const ACTS_BY_TRACK: Record<
  ArchitectureDesignTrack,
  Record<keyof typeof SERVER_ACTS, DesignActCopy>
> = { server: SERVER_ACTS, frontend: FRONTEND_ACTS, data: DATA_ACTS };

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

function designQuestions(
  designArtifact: ArchitectureDesignReviewArtifact,
  acts: Record<keyof typeof SERVER_ACTS, DesignActCopy> = SERVER_ACTS
): PlannedQuestion[] {
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
      mustHit: acts.frame.mustHit,
      probeIfMissing: acts.frame.probeIfMissing,
      stage: "design-frame",
      requiredForPacing: true
    }),
    designQuestion({
      section: "design",
      scenarioTitle: designArtifact.scenario.title,
      text: acts.design.text!,
      sources: [contracts, architecture],
      competency: "Architecture and trade-offs",
      mustHit: acts.design.mustHit,
      probeIfMissing: acts.design.probeIfMissing,
      stage: "design-canvas",
      requiredForPacing: true
    }),
    designQuestion({
      section: "deep-dive",
      scenarioTitle: designArtifact.scenario.title,
      text: acts["deep-dive"].text!,
      sources: [contracts, architecture],
      competency: "Technical depth",
      mustHit: acts["deep-dive"].mustHit,
      probeIfMissing: acts["deep-dive"].probeIfMissing,
      stage: "design-deep-dive",
      requiredForPacing: true
    }),
    designQuestion({
      section: "pressure",
      scenarioTitle: designArtifact.scenario.title,
      text: `Pressure test: ${pressureTests.join(" ")} ${acts.pressure.text}`,
      sources: [architecture, operations],
      competency: "Scale and failure response",
      mustHit: acts.pressure.mustHit,
      probeIfMissing: acts.pressure.probeIfMissing,
      stage: "design-pressure",
      requiredForPacing: true
    }),
    designQuestion({
      section: "defend",
      scenarioTitle: designArtifact.scenario.title,
      text: acts.defend.text!,
      sources: [operations],
      competency: "Reliability and evolution",
      mustHit: acts.defend.mustHit,
      probeIfMissing: acts.defend.probeIfMissing,
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
