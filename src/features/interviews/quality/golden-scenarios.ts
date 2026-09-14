import type { DecideInput } from "../server/decider";
import { buildHiringManagerPlan } from "../server/hiring-manager-round";
import type { TechnicalAnswerEvaluationInput } from "../server/technical-answer-evaluator";
import type { DecisionAction, TechnicalVerdict } from "../server/types";

export const INTERVIEW_GOLD_SET_VERSION = "hr-gold-v2";

export interface DecisionGoldenScenario {
  id: string;
  description: string;
  input: DecideInput;
  expected: {
    actions: DecisionAction[];
    /** At least one stem should appear in a non-move-on question. */
    groundingTerms?: string[];
    /** The closing candidate-question case must receive a transparent answer. */
    candidateResponse?: "required";
  };
}

export interface ScoringGoldenScenario {
  id: string;
  description: string;
  input: TechnicalAnswerEvaluationInput;
  expected: {
    score: { min: number; max: number };
    verdicts: TechnicalVerdict[];
  };
}

const setup = {
  role: "fullstack" as const,
  level: "3-5" as const,
  roundType: "hiring-manager" as const,
  intensity: "realistic" as const,
  context: "Mid-level full-stack engineer interviewing for a product engineering role.",
  resumeRound: true,
  templateId: "hiring-manager-final",
  templateTitle: "Hiring Manager & Final Behavioural"
};

const plan = buildHiringManagerPlan();

function decisionInput(questionIndex: number, userAnswer: string, followUpCount = 0): DecideInput {
  const question = plan[questionIndex];
  if (!question) throw new Error(`Missing Hiring Manager golden question ${questionIndex}`);
  return {
    setup,
    questionAsked: question.text,
    evidenceAnchor: question.evidenceAnchor,
    competency: question.competency,
    intent: question.intent,
    questionKind: "conversation",
    mustHit: question.mustHit,
    userAnswer,
    followUpCount,
    maxFollowUps: question.maxFollowUps,
    interviewStage: question.stage,
    conversationHistory: [{ speaker: "agent", text: question.text }]
  };
}

export const DECISION_GOLDEN_SCENARIOS: DecisionGoldenScenario[] = [
  {
    id: "career-vague-needs-concrete-turning-point",
    description: "A generic introduction should receive one narrow career follow-up.",
    input: decisionInput(0, "I studied computer science and then worked at a few companies."),
    expected: { actions: ["probe"], groundingTerms: ["turn", "company", "career", "move"] }
  },
  {
    id: "career-genuine-follow-thread",
    description: "A credible introduction should be followed through its meaningful transition.",
    input: decisionInput(
      0,
      "I moved from support into engineering after automating our refund workflow. I then joined NovaCart and now own checkout reliability."
    ),
    expected: {
      actions: ["probe"],
      groundingTerms: ["support", "refund", "automation", "checkout", "transition", "move"]
    }
  },
  {
    id: "role-fit-vague-priority",
    description: "A vague role preference should be narrowed to a real priority.",
    input: decisionInput(1, "I want growth, good culture, and interesting work."),
    expected: {
      actions: ["probe", "challenge"],
      groundingTerms: ["growth", "culture", "interesting", "priority", "matter"]
    }
  },
  {
    id: "role-fit-second-follow-up-tests-tradeoff",
    description: "The second role-fit probe should test a trade-off, not repeat the preference.",
    input: {
      ...decisionInput(
        1,
        "Autonomy matters most because I do my best work when I can own a problem through delivery.",
        1
      ),
      conversationHistory: [
        { speaker: "agent", text: plan[1]!.text },
        { speaker: "user", text: "I want growth, autonomy, and a strong team." },
        { speaker: "agent", text: "Which one matters most to you?" }
      ]
    },
    expected: {
      actions: ["probe", "challenge", "move_on"],
      groundingTerms: ["autonomy", "trade", "accept", "give", "priority"]
    }
  },
  {
    id: "work-vague-team-ownership",
    description: "A team-level claim should be countered with a personal-action question.",
    input: decisionInput(2, "We rebuilt checkout and it went really well."),
    expected: {
      actions: ["probe", "challenge"],
      groundingTerms: ["you", "your", "personally", "decision", "checkout"]
    }
  },
  {
    id: "work-complete-after-two-followups",
    description: "A complete story at the section cap should move on cleanly.",
    input: {
      ...decisionInput(
        3,
        "I chose a reversible feature flag, told support what signals to watch, and rolled back when payment errors rose. We restored conversion that afternoon and added a release checklist.",
        2
      ),
      evidenceLedger: {
        ownership: ["I chose the feature flag and rollback."],
        decision: ["Used a reversible release because information was incomplete."],
        specificity: ["Payment errors rose during rollout."],
        outcome: ["Conversion recovered and a checklist was added."],
        gaps: []
      }
    },
    expected: { actions: ["move_on"] }
  },
  {
    id: "final-vague-accountability",
    description: "A vague failure answer may receive one calm accountability probe.",
    input: decisionInput(5, "A release failed once, but the team fixed it."),
    expected: {
      actions: ["probe", "challenge"],
      groundingTerms: ["you", "your", "responsib", "change", "release"]
    }
  },
  {
    id: "final-complete-moves-on",
    description: "A complete accountability story should not be interrogated further.",
    input: decisionInput(
      5,
      "I approved a migration without checking the rollback script. When it failed, I owned the incident, restored the backup, and added a rehearsed rollback gate to our release process."
    ),
    expected: { actions: ["move_on"] }
  },
  {
    id: "misheard-answer-clarifies",
    description: "A fragmentary transcript should be clarified instead of interpreted as evidence.",
    input: decisionInput(4, "uh the the manager audio cut sorry"),
    expected: {
      actions: ["clarify"],
      groundingTerms: ["disagreement", "teammate", "manager"]
    }
  },
  {
    id: "candidate-question-gets-simulated-answer",
    description:
      "The final candidate question should receive a useful answer without invented company facts.",
    input: {
      ...decisionInput(
        7,
        "I value direct feedback and clear ownership. What does success look like in this role?"
      ),
      acceptsCandidateQuestions: true
    },
    expected: { actions: ["move_on"], candidateResponse: "required" }
  }
];

function scoringInput(questionIndex: number, answers: string[]): TechnicalAnswerEvaluationInput {
  const question = plan[questionIndex];
  if (!question) throw new Error(`Missing Hiring Manager scoring question ${questionIndex}`);
  return { setup, question, answers, rubric: [], execution: null, evaluatedAt: 1_000 };
}

export const SCORING_GOLDEN_SCENARIOS: ScoringGoldenScenario[] = [
  {
    id: "strong-ownership-story",
    description: "Concrete ownership, reasoning, action, and outcome should score strongly.",
    input: scoringInput(2, [
      "I owned checkout retry safety. Duplicate charges were our main risk, so I chose idempotency keys over client-only retries. I implemented the API and rollout dashboard. Failed checkouts fell from 3.1% to 1.8%, with no duplicate-charge incidents in the next quarter."
    ]),
    expected: { score: { min: 78, max: 100 }, verdicts: ["correct", "mostly-correct"] }
  },
  {
    id: "vague-team-only-answer",
    description: "Generic team claims without personal evidence should remain low.",
    input: scoringInput(2, ["We worked hard as a team and the project was successful."]),
    expected: {
      score: { min: 0, max: 44 },
      verdicts: ["incorrect", "insufficient-evidence", "partially-correct"]
    }
  },
  {
    id: "unsupported-number-is-not-proof",
    description: "A metric without action or context must not manufacture strong evidence.",
    input: scoringInput(2, ["We improved everything by 80 percent and stakeholders were happy."]),
    expected: {
      score: { min: 0, max: 54 },
      verdicts: ["incorrect", "insufficient-evidence", "partially-correct"]
    }
  },
  {
    id: "accountability-and-demonstrated-change",
    description: "Owning a mistake and changing the system should score above a vague apology.",
    input: scoringInput(5, [
      "I approved a schema migration without testing rollback. I told the incident lead it was my miss, restored the backup, and wrote the rollback rehearsal we now require before migrations. The next two migrations completed without rollback issues."
    ]),
    expected: { score: { min: 72, max: 100 }, verdicts: ["correct", "mostly-correct"] }
  }
];
