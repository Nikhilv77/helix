import { z } from "zod";
import { findQuestion } from "@/lib/dsa/dsa";
import { AiService } from "../ai/ai.service";
import { Logger } from "../common/logger";
import {
  describeLevel,
  describeRole,
  describeRound,
  isDsaRound,
  isResumeRound,
  levelFocus
} from "./prompt-context";
import {
  applyPersonalizedBlueprintFormats,
  buildPersonalizedBlueprintPrompt,
  createPersonalizedBlueprintFallback,
  personalizedQuestionSlots
} from "./personalized-blueprint-runtime";
import { InterviewSetup, PlannedQuestion, QUESTION_COUNT } from "./types";

const DEFAULT_PLANNING_BUDGET_MS = 8_000;

const plannedQuestionSchema = z.object({
  text: z.string().min(1).max(180),
  evidenceAnchor: z.string().min(2).max(180),
  competency: z.string().min(2).max(48),
  intent: z.string().min(8).max(160),
  mustHit: z.array(z.string().min(1)).min(2).max(3),
  probeIfMissing: z.string().min(1).max(160)
});

/**
 * The array bounds are part of the JSON schema the provider sees, so they have
 * to track the round's own question count. A DSA round asks three, the default
 * arc asks four, and a longer round may ask five.
 */
function buildPlanSchema(questionCount: number) {
  return z.object({
    questions: z.array(plannedQuestionSchema).min(questionCount).max(questionCount)
  });
}

const SYSTEM_INSTRUCTION = `You are a senior interviewer designing a coherent, evidence-led interview. Return only JSON matching the requested schema.

Write questions a skilled human interviewer would naturally ask aloud. The set must feel like one conversation, not a list generated from a resume. Every question must reveal evidence that cannot be faked with generic interview advice.

Use relaxed spoken English, with simple wording and a clear reason for asking. Do not sound like a questionnaire, rubric, or resume parser.`;

/**
 * A DSA round is not planned from a resume. The problems are already chosen and
 * the workspace renders them one at a time, in order, so the plan's only job is
 * to turn each problem into a question a human interviewer would actually ask.
 */
function buildDsaPrompt(setup: InterviewSetup, questionCount: number): string {
  const problems = dsaProblems(setup).slice(0, questionCount);

  return `Design a DSA coding interview for a ${describeLevel(setup.level)}.

The candidate has practised these problems, and the workspace shows them one at a time in exactly this order:

${problems
  .map(
    (problem, index) =>
      `${index + 1}. ${problem.title} (${problem.difficulty}, ${problem.pattern})\n   ${problem.statement}`
  )
  .join("\n")}

Produce exactly ${questionCount} questions, one per problem, in that order. Question 1 is about problem 1, question 2 about problem 2, and so on. Never ask about a problem that is not on this list, and never combine two problems into one question.

Constraints:
- Open each question by naming the problem, so the candidate knows which one is on screen.
- Ask for the approach first. Complexity, correctness, and edge cases are what the follow-ups are for.
- Use relaxed spoken English. One natural sentence, at most 20 words, asking exactly one thing.
- Never state the solution, the optimal data structure, or the complexity in the question itself.
- Do not include Markdown or code. The candidate writes code in the workspace.
- ${levelFocus(setup.level)}

For each question return:
- text: the exact words spoken. One natural sentence, at most 20 words.
- evidenceAnchor: the problem title, copied exactly.
- competency: a short label such as Algorithmic reasoning, Data structure choice, or Complexity analysis.
- intent: one sentence explaining what strong evidence this question should uncover.
- mustHit: 2-3 observable pieces of evidence, such as the chosen data structure, the time and space complexity, or the edge case that breaks a naive attempt.
- probeIfMissing: one specific fallback question for the most likely missing evidence, at most 18 words.`;
}

function buildPrompt(setup: InterviewSetup): string {
  if (setup.personalizedBlueprint) return buildPersonalizedBlueprintPrompt(setup);
  const questionCount = setup.questionCount ?? QUESTION_COUNT;
  const agenda = setup.agenda?.filter((item) => item.trim().length > 0) ?? [];
  if (isDsaRound(setup)) return buildDsaPrompt(setup, questionCount);
  const resumeGuidance = isResumeRound(setup)
    ? "This is a resume-defense round. Start from the candidate's actual evidence and let the conversation deepen around one or two strongest stories. Ask what happened, what they personally did, why they chose it, what changed, and what they would do differently now. Treat resume claims as starting points, not facts to praise. Every evidenceAnchor must copy or tightly paraphrase a named role, project, technology, achievement, or metric from the candidate context. Never invent a company, project, technology, or number."
    : "";

  // A chosen template replaces the default arc. Anything outside it is off
  // limits, otherwise "Defend your projects" drifts into a general round.
  const arc = agenda.length
    ? `The candidate chose a focused round${setup.templateTitle ? `: "${setup.templateTitle}"` : ""}. Produce exactly ${questionCount} questions that serve this agenda in order, and nothing outside it:
${agenda.map((item, index) => `${index + 1}. ${item}`).join("\n")}

Where the agenda has fewer entries than ${questionCount} questions, split the richest objective into two questions rather than introducing a new topic.`
    : `Produce exactly ${questionCount} questions as one deliberate arc:
1. Establish the candidate's personal ownership and the real context.
2. Deep-dive into one consequential decision and its trade-off.
3. Examine a failure, constraint, disagreement, or difficult debugging moment.
4. Test impact, judgement, and what they would change now.`;

  return `Design a ${describeRound(setup.roundType)} interview for a ${describeLevel(setup.level)} interviewing as a ${describeRole(setup.role)}.

The candidate describes their experience as:
"""
${setup.context.trim()}
"""

${arc}

${resumeGuidance}

Constraints:
- Use relaxed spoken English, with simple wording and a clear reason for asking.
- At least 3 questions must anchor to a concrete system, product, technology, number, or problem in the candidate's context.
- Question 1 is a focused warm-up, answerable in about 60 seconds.
- Each question asks exactly one thing. Never combine two questions with "and".
- Questions 2-4 should build on the same strongest experience when possible, while testing different competencies.
- No question may be answerable by someone who has not done the work.
- Banned openers: "tell me about yourself", "what is your greatest weakness", "why do you want this job".
- Ban trivia, definitions, hypotheticals detached from their experience, and requests to recite a technology stack.
- If the context is too thin to ground a question, ask about a decision they must have faced in this role at this level. Never ask trivia.
- Do not include Markdown or code. Trailgrad attaches a practical role-specific code exercise separately for technical engineering rounds.
- ${levelFocus(setup.level)}
- Avoid stiff phrases such as "please elaborate", "can you explain further", and "what was your role". Ask the natural version instead.

For each question return:
- text: the exact words spoken. One natural sentence, at most 20 words.
- evidenceAnchor: the exact short claim, project, role, technology, achievement, or metric that motivated the question.
- competency: a short label such as Ownership, Technical judgement, Incident response, Collaboration, or Impact.
- intent: one sentence explaining what strong evidence this question should uncover.
- mustHit: 2-3 observable pieces of evidence, written concretely rather than as abstract qualities.
- probeIfMissing: one specific fallback question for the most likely missing evidence, at most 18 words.`;
}

export class InterviewPlanner {
  private readonly logger = new Logger(InterviewPlanner.name);

  constructor(
    private readonly ai: AiService,
    private readonly planningBudgetMs = DEFAULT_PLANNING_BUDGET_MS
  ) {}

  async plan(setup: InterviewSetup): Promise<PlannedQuestion[]> {
    const expectedCount = setup.personalizedBlueprint
      ? personalizedQuestionSlots(setup.personalizedBlueprint, setup.questionCount).length
      : (setup.questionCount ?? QUESTION_COUNT);

    try {
      const result = await withDeadline(
        this.ai.generateStructured({
          operation: "interview.plan",
          systemInstruction: SYSTEM_INSTRUCTION,
          prompt: buildPrompt(setup),
          schema: buildPlanSchema(expectedCount),
          modelClass: "fast",
          temperature: 0.2
        }),
        this.planningBudgetMs
      );

      if (result.questions.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} questions, received ${result.questions.length}`);
      }
      return applyQuestionFormats(setup, result.questions);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "interview.plan.fallback",
          reason: error instanceof Error ? error.message : "unknown planning error"
        })
      );

      return createFallbackPlan(setup);
    }
  }
}

export function createFallbackPlan(setup: InterviewSetup): PlannedQuestion[] {
  if (setup.personalizedBlueprint) return createPersonalizedBlueprintFallback(setup);
  if (isDsaRound(setup)) return createDsaFallbackPlan(setup);

  const evidenceAnchor = fallbackEvidenceAnchor(setup);
  const decisionQuestion: Record<InterviewSetup["role"], string> = {
    backend: "Which reliability or data-flow decision created the hardest trade-off in that work?",
    frontend:
      "Which state or performance decision created the hardest user-facing trade-off in that work?",
    fullstack: "Which frontend-backend boundary created the hardest trade-off in that work?",
    data: "Which pipeline correctness or scale decision created the hardest trade-off in that work?",
    "ai-ml": "Which model or evaluation decision created the hardest trade-off in that work?",
    pm: "Which prioritization decision created the hardest customer trade-off in that work?"
  };
  const coding = fallbackCodingQuestion(setup);

  return (
    [
      {
        text: "What did you personally own end to end in the experience you shared?",
        evidenceAnchor,
        kind: "conversation",
        language: "",
        codeTask: "",
        codeSnippet: "",
        competency: "Ownership",
        intent: "Establish the candidate's scope, boundaries, and direct contribution.",
        mustHit: ["personal responsibility", "project context"],
        probeIfMissing: "Which part would not have happened without your contribution?"
      },
      {
        text: decisionQuestion[setup.role],
        evidenceAnchor,
        kind: "conversation",
        language: "",
        codeTask: "",
        codeSnippet: "",
        competency: "Technical judgement",
        intent: "Reveal a consequential decision and the evidence used to make it.",
        mustHit: ["alternatives considered", "reason for the choice"],
        probeIfMissing: "What alternative did you reject, and why?"
      },
      coding ?? {
        text: "What failure or constraint most changed your approach during that work?",
        evidenceAnchor,
        kind: "conversation",
        language: "",
        codeTask: "",
        codeSnippet: "",
        competency: "Adaptability",
        intent: "Test how the candidate responds when the original approach stops working.",
        mustHit: ["specific constraint", "change in approach"],
        probeIfMissing: "What did you change after discovering it?"
      },
      {
        text: "What measurable outcome changed because of your work?",
        evidenceAnchor,
        kind: "conversation",
        language: "",
        codeTask: "",
        codeSnippet: "",
        competency: "Impact",
        intent: "Connect the candidate's decisions to a concrete result and reflection.",
        mustHit: ["measurable result", "personal contribution"],
        probeIfMissing: "How did you know the change was successful?"
      }
    ] as PlannedQuestion[]
  ).slice(0, setup.questionCount ?? QUESTION_COUNT);
}

function applyQuestionFormats(
  setup: InterviewSetup,
  questions: PlannedQuestion[]
): PlannedQuestion[] {
  if (setup.personalizedBlueprint) {
    return applyPersonalizedBlueprintFormats(setup, questions);
  }
  const formatted: PlannedQuestion[] = questions.map((question) => ({
    ...question,
    kind: "conversation" as const,
    language: "",
    codeTask: "",
    codeSnippet: ""
  }));

  // A DSA round is already all code. Its questions carry the selected problem
  // instead of the generic role exercise, and the position of each question has
  // to keep matching `dsaQuestionSlugs`, which is what the workspace renders.
  if (isDsaRound(setup)) return applyDsaFormats(setup, formatted);

  const coding = fallbackCodingQuestion(setup);
  if (coding && formatted.length > 2) formatted[2] = coding;
  return formatted;
}

/**
 * Stamps each planned question with the problem the workspace will show at that
 * index, so a model that drifts off the requested order cannot leave Maya
 * asking about one problem while the editor shows another.
 */
function applyDsaFormats(setup: InterviewSetup, questions: PlannedQuestion[]): PlannedQuestion[] {
  const problems = dsaProblems(setup);

  return questions.map((question, index) => {
    const problem = problems[index];
    if (!problem) return question;

    return {
      ...question,
      kind: "code" as const,
      language: "",
      codeTask: `${problem.title}: ${problem.statement}`,
      codeSnippet: "",
      evidenceAnchor: problem.title
    };
  });
}

interface DsaProblem {
  slug: string;
  title: string;
  difficulty: string;
  pattern: string;
  statement: string;
}

/** The selected problems, in the order the workspace shows them. */
function dsaProblems(setup: InterviewSetup): DsaProblem[] {
  return (setup.dsaQuestionSlugs ?? []).map((slug) => {
    const question = findQuestion(slug)?.question;

    return {
      slug,
      title: question?.title ?? slug,
      difficulty: question?.difficulty ?? "unknown difficulty",
      pattern: question?.primaryPattern ?? "unknown pattern",
      statement:
        question?.problemStatement ??
        question?.promptSummary ??
        "Discuss the approach, complexity, and edge cases."
    };
  });
}

/**
 * Used when planning fails. Every question is derived from a selected problem,
 * so a failed provider call degrades the phrasing rather than replacing the
 * round with unrelated questions.
 */
function createDsaFallbackPlan(setup: InterviewSetup): PlannedQuestion[] {
  return dsaProblems(setup)
    .slice(0, setup.questionCount ?? QUESTION_COUNT)
    .map((problem) => ({
      text: `Walk me through how you would solve ${problem.title}.`,
      evidenceAnchor: problem.title,
      kind: "code" as const,
      language: "",
      codeTask: `${problem.title}: ${problem.statement}`,
      codeSnippet: "",
      competency: "Algorithmic reasoning",
      intent: `Establish whether the candidate can reason through ${problem.title} rather than recall a memorised solution.`,
      mustHit: ["the approach and the data structure it needs", "time and space complexity"],
      probeIfMissing: "What is the time and space complexity of that approach?"
    }));
}

function fallbackCodingQuestion(setup: InterviewSetup): PlannedQuestion | null {
  if (setup.roundType !== "technical" || setup.role === "pm") return null;

  const tasks: Record<
    Exclude<InterviewSetup["role"], "pm">,
    Pick<PlannedQuestion, "language" | "codeTask" | "codeSnippet">
  > = {
    backend: {
      language: "typescript",
      codeTask: "Make this payment handler idempotent and safe under concurrent retries.",
      codeSnippet: `async function capturePayment(req: Request) {
  const { orderId, amount } = await req.json();
  const existing = await db.payment.findFirst({
    where: { orderId }
  });

  if (existing) return existing;
  const charge = await gateway.charge(amount);
  return db.payment.create({
    data: { orderId, chargeId: charge.id, amount }
  });
}`
    },
    frontend: {
      language: "tsx",
      codeTask:
        "Fix the stale state and request-race problems without hiding loading or error states.",
      codeSnippet: `function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    fetch('/api/search?q=' + query)
      .then((response) => response.json())
      .then((data) => setResults([...results, ...data]));
  }, [query]);

  return results.map((result) => (
    <ResultRow key={result.id} result={result} />
  ));
}`
    },
    fullstack: {
      language: "typescript",
      codeTask: "Make this inventory reservation correct when two customers check out at once.",
      codeSnippet: `export async function reserve(productId: string, count: number) {
  const item = await db.inventory.findUnique({
    where: { productId }
  });

  if (!item || item.available < count) {
    throw new Error('Out of stock');
  }

  return db.inventory.update({
    where: { productId },
    data: { available: item.available - count }
  });
}`
    },
    data: {
      language: "python",
      codeTask:
        "Make this incremental job replay-safe without loading the entire table into memory.",
      codeSnippet: `def sync_orders(source, warehouse, checkpoint):
    rows = source.query(
        "SELECT * FROM orders WHERE updated_at > %s",
        checkpoint,
    )

    for row in rows:
        warehouse.insert("orders", row)

    newest = max(row["updated_at"] for row in rows)
    save_checkpoint(newest)
    return len(rows)`
    },
    "ai-ml": {
      language: "python",
      codeTask:
        "Remove the evaluation leakage and make the reported score representative of production.",
      codeSnippet: `data = load_training_data()
features = build_features(data)

scaler = StandardScaler()
features = scaler.fit_transform(features)

train, test = train_test_split(
    features, test_size=0.2, random_state=42
)
model = train_model(train, data.labels)
print(evaluate(model, test, data.labels))`
    }
  };
  const task = tasks[setup.role];

  return {
    text: "Review the code on screen and walk me through the change you would ship.",
    evidenceAnchor: `Production ${setup.role} scenario aligned with the candidate's target role`,
    kind: "code",
    ...task,
    competency: "Practical engineering",
    intent:
      "Test whether the candidate can find a production risk and implement a defensible correction.",
    mustHit: ["root cause", "corrected implementation", "trade-off or verification"],
    probeIfMissing: "How would you prove your change is correct under failure?"
  };
}

function fallbackEvidenceAnchor(setup: InterviewSetup): string {
  const normalized = setup.context.replace(/\s+/g, " ").trim();
  if (!normalized) return `${setup.role} experience shared by the candidate`;
  return normalized.length > 160 ? `${normalized.slice(0, 159).trimEnd()}…` : normalized;
}

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Interview planning exceeded ${timeoutMs}ms`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
