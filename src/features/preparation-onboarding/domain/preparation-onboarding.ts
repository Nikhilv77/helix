import type { Role } from "@/lib/shared/types";
import {
  APPLIED_ENGINEERING_QUESTION_BANK,
  appliedEngineeringQuestion
} from "./applied-engineering-question-bank";
import { ARCHITECTURE_QUESTION_BANK, architectureQuestion } from "./architecture-question-bank";
import {
  AI_ML_APPLIED_ENGINEERING_QUESTION_BANK,
  aiMlAppliedEngineeringQuestion
} from "./ai-ml-applied-engineering-question-bank";
import {
  AI_ML_ARCHITECTURE_QUESTION_BANK,
  aiMlArchitectureQuestion
} from "./ai-ml-architecture-question-bank";
import {
  DSA_QUESTION_BANK,
  dsaBankQuestion,
  dsaQuestionIndexes,
  type DsaQuestionDifficulty,
  type DsaQuestionKind,
  type DsaQuestionSlot
} from "./dsa-question-bank";
import type { PreparationAreaId } from "./preparation-areas";

export const BASELINE_SECTIONS = [
  "dsa-familiarity", "dsa-lookup", "dsa-binary-search", "dsa-tree-bfs", "dsa-adaptive",
  "dsa-code-lookup", "dsa-code-binary-search",
  "technical-1", "technical-2", "technical-3", "engineering", "architecture"
] as const;
export type BaselineSection = (typeof BASELINE_SECTIONS)[number];
export type DsaStartingState = "experienced-active" | "experienced-rusty" | "some-familiarity" | "needs-foundations" | "unknown";
export type TopicFamiliarity = "familiar" | "needs-refresh" | "unknown";

export const PREPARATION_ONBOARDING_STAGES = [
  "target_role", "target_level", "target_timeline", "preparation_areas", "target_company", "baseline_intro",
  "baseline_dsa_familiarity", "baseline_dsa_lookup", "baseline_dsa_binary_search", "baseline_dsa_tree_bfs", "baseline_dsa_adaptive", "baseline_dsa_code_lookup", "baseline_dsa_code_binary_search",
  "baseline_technical_1", "baseline_technical_2", "baseline_technical_3", "baseline_engineering", "baseline_architecture", "completed"
] as const;
export type PreparationOnboardingStage = (typeof PREPARATION_ONBOARDING_STAGES)[number];

export const BASELINE_STAGE_BY_SECTION: Record<BaselineSection, PreparationOnboardingStage> = {
  "dsa-familiarity": "baseline_dsa_familiarity", "dsa-lookup": "baseline_dsa_lookup",
  "dsa-binary-search": "baseline_dsa_binary_search", "dsa-tree-bfs": "baseline_dsa_tree_bfs",
  "dsa-adaptive": "baseline_dsa_adaptive", "dsa-code-lookup": "baseline_dsa_code_lookup",
  "dsa-code-binary-search": "baseline_dsa_code_binary_search", "technical-1": "baseline_technical_1",
  "technical-2": "baseline_technical_2", "technical-3": "baseline_technical_3", engineering: "baseline_engineering", architecture: "baseline_architecture"
};

export type BaselineAnswer = { choiceId: string; answeredAt: number };
export type CandidateSkillSignal = {
  areaId: PreparationAreaId;
  /** A short onboarding pulse is deliberately never a readiness score. */
  score: null;
  confidence: number;
  evidence: "baseline" | "not-enough-evidence";
  startingState?: DsaStartingState;
  topics?: Array<{ label: string; familiarity: TopicFamiliarity }>;
};
export type CandidateSkillProfile = { source: "initial-baseline"; generatedAt: number; signals: CandidateSkillSignal[] };
export type PreparationOnboardingState = {
  stage: PreparationOnboardingStage; updatedAt: number; completedAt: number | null; baselineStartedAt: number | null;
  answers: Partial<Record<BaselineSection, BaselineAnswer>>;
  /** Fixed at baseline start so a refresh never replaces a candidate's question. */
  questionIds: Partial<Record<BaselineSection, string>>;
  /** Immutable assigned question; its answer key is stripped from public responses. */
  questions: Partial<Record<BaselineSection, BaselineQuestion>>;
  skillProfile: CandidateSkillProfile | null;
};
export type BaselineQuestion = {
  section: BaselineSection; eyebrow: string; title: string; prompt: string;
  options: Array<{ id: string; label: string }>; correctOptionId?: string;
  code?: { value: string; language: string };
};

export const BASELINE_DURATION_LABEL = "About 12–15 minutes";

/** Small, varied prompts make the teacher sound present—not scripted. */
export function baselineQuestionTeacherCue(section: BaselineSection, questionId?: string): string {
  const cuesBySection: Record<BaselineSection, string[]> = {
    "dsa-familiarity": ["Be honest with yourself here—there’s no trick.", "Take a second and choose what feels most true today.", "This just helps me meet you at the right starting point."],
    "dsa-lookup": ["Read the constraint carefully and think about the operation you need most.", "Take your time—look for the structure that removes repeated work.", "You’ve got this. Focus on what needs to be fast."],
    "dsa-binary-search": ["Pause for a moment and look for the monotonic clue.", "Read carefully—notice how the search space behaves.", "Think about whether one side can be ruled out each time."],
    "dsa-tree-bfs": ["Picture the problem one level at a time before you choose.", "No rush—think about how the work would spread through the structure.", "Read the traversal requirement closely; the wording is the hint."],
    "dsa-adaptive": ["Nice—take one more beat and focus on the window constraint.", "You’re doing well. Think about what the left and right pointers must preserve.", "Read it slowly; the contiguous range is the important clue."],
    "dsa-code-lookup": ["You’ve got the idea—now read the order of those two lines carefully.", "Take a moment with the snippet. Ask what information must be checked before it changes.", "Read this one line by line; the order is the whole point."],
    "dsa-code-binary-search": ["Now trace one pass through the loop before you choose.", "Take your time with the bounds—notice which half can be ruled out.", "Read the comparison carefully, then follow where the target could still be."],
    "technical-1": ["Take a moment and reason from the real production constraint.", "Read carefully—choose the first useful move, not the biggest change.", "There’s no rush. Look for the boundary that needs attention."],
    "technical-2": ["Think it through before you answer; practical details matter here.", "Take your time and follow the data through the system.", "Read the scenario closely—the safest next step is usually in the constraint."],
    "technical-3": ["One more small decision—trust your engineering instinct.", "Pause and look for the failure mode before choosing.", "Read it carefully; you’re looking for the reliable path."],
    engineering: ["Take your time—start with the evidence before changing anything.", "Think like you’re on call: what would you want to know first?", "Read the trade-off carefully; the calm first move matters."],
    architecture: ["Zoom out for a moment and think about the boundary, not just one component.", "Take your time—start from the constraint the system must satisfy.", "Think through the failure and growth path before you choose."]
  };
  const cues = cuesBySection[section];
  return cues[hash(`${section}:${questionId ?? "default"}`) % cues.length]!;
}

/** DSA is not part of the initial AI/ML or legacy Product baseline. */
export function includesDsaPulse(role: Role): boolean {
  return role !== "ai-ml" && role !== "pm";
}

export function firstBaselineSection(role: Role): BaselineSection {
  return includesDsaPulse(role) ? "dsa-familiarity" : "technical-1";
}

/** The AI/ML pool is intentionally deeper because it is its own interview discipline. */
export const CORE_TECHNICAL_QUESTION_COUNTS: Record<Role, number> = {
  frontend: 9,
  backend: 9,
  fullstack: 8,
  data: 8,
  "ai-ml": 59,
  pm: 8
};

/**
 * Select once on the server and persist the ids with the onboarding state.
 * This gives candidates different, equivalent prompts while keeping a resumed
 * attempt stable and auditable.
 */
export function selectBaselineQuestionIds(seed: string, role: Role): Partial<Record<BaselineSection, string>> {
  const technical = shuffled(
    Array.from({ length: CORE_TECHNICAL_QUESTION_COUNTS[role] }, (_, index) => `technical-${index}`),
    `${seed}:${role}:technical`
  );
  const dsaId = (section: DsaQuestionSlot, kind: DsaQuestionKind, difficulty: DsaQuestionDifficulty) => {
    const indexes = dsaQuestionIndexes(section, kind, difficulty);
    const fallback = DSA_QUESTION_BANK[section].map((_, index) => index);
    const choices = indexes.length ? indexes : fallback;
    return `dsa-${section.replace("dsa-", "")}-${choices[hash(`${seed}:${role}:${section}`) % choices.length]!}`;
  };
  return {
    "dsa-familiarity": "familiarity-v1",
    "dsa-lookup": dsaId("dsa-lookup", "leetcode", "foundation"),
    "dsa-binary-search": dsaId("dsa-binary-search", "reasoning", "foundation"),
    "dsa-tree-bfs": dsaId("dsa-tree-bfs", hash(`${seed}:${role}:tree-kind`) % 2 ? "reasoning" : "leetcode", "foundation"),
    "dsa-adaptive": dsaId("dsa-adaptive", hash(`${seed}:${role}:adaptive-kind`) % 2 ? "reasoning" : "leetcode", "intermediate"),
    "dsa-code-lookup": "dsa-code-lookup-v1",
    "dsa-code-binary-search": "dsa-code-binary-search-v1",
    "technical-1": technical[0],
    "technical-2": technical[1],
    "technical-3": technical[2],
    engineering: role === "ai-ml"
      ? `ai-ml-engineering-${hash(`${seed}:${role}:engineering`) % AI_ML_APPLIED_ENGINEERING_QUESTION_BANK.length}`
      : `engineering-${hash(`${seed}:${role}:engineering`) % APPLIED_ENGINEERING_QUESTION_BANK.length}`,
    architecture: role === "ai-ml"
      ? `ai-ml-architecture-${hash(`${seed}:${role}:architecture`) % AI_ML_ARCHITECTURE_QUESTION_BANK.length}`
      : `architecture-${hash(`${seed}:${role}:architecture`) % ARCHITECTURE_QUESTION_BANK.length}`
  };
}

export function baselineQuestion(section: BaselineSection, role: Role, questionId?: string): BaselineQuestion {
  if (section === "dsa-familiarity") return {
    section, eyebrow: "DSA pulse · a quick starting point", title: "How familiar are you with DSA?",
    prompt: "Think specifically about interview-style coding and problem solving.",
    options: [
      { id: "regular", label: "I practice regularly" }, { id: "rusty", label: "I’ve practiced before, but I’m rusty" },
      { id: "some", label: "I’ve done some, but I’m not very confident" }, { id: "new", label: "I’m mostly new to DSA" }
    ]
  };
  if (section === "dsa-code-lookup") return {
    ...question(section, "", "Reading a set", "Why must seen.has(event.id) run before seen.add(event.id) in this loop?", ["check-first|It detects a duplicate against earlier events before recording the current one", "sort-events|It sorts events by ID", "arrival-order|It guarantees events arrive in order", "free-ids|It frees old event IDs automatically"], "check-first"),
    code: {
      language: "typescript",
      value: "const seen = new Set<string>();\n\nfor (const event of events) {\n  if (seen.has(event.id)) continue;\n  seen.add(event.id);\n  process(event);\n}"
    }
  };
  if (section === "dsa-code-binary-search") return {
    ...question(section, "", "Moving the boundary", "nums[mid] is smaller than target. Which update keeps the possible insert position in the remaining range?", ["advance-low|Set low to mid + 1", "lower-high|Set high to mid - 1", "keep-bounds|Keep both boundaries unchanged", "return-mid|Return mid immediately"], "advance-low"),
    code: {
      language: "typescript",
      value: "let low = 0;\nlet high = nums.length - 1;\n\nwhile (low <= high) {\n  const mid = low + Math.floor((high - low) / 2);\n  if (nums[mid] < target) low = mid + 1;\n  else high = mid - 1;\n}\n\nreturn low;"
    }
  };
  if (section === "technical-1" || section === "technical-2" || section === "technical-3") return technicalQuestion(role, section, questionId);
  if (section === "architecture") {
    const selected = questionVariant(section, role, questionId);
    return selected ?? question(section, "", "Design the boundary", "A system must stay available as demand grows. What should architecture decisions begin with?", ["user-journeys|The user journey, constraints, and measurable reliability goals", "diagram-first|A diagram with no requirements", "database-first|Choosing a database before defining access patterns", "servers-first|Adding servers before measuring demand"], "user-journeys");
  }

  const common: Record<"dsa-lookup" | "dsa-binary-search" | "dsa-tree-bfs" | "dsa-adaptive" | "engineering", BaselineQuestion> = {
    "dsa-lookup": question(section, "DSA pulse · quick pattern check", "Fast lookup", "You need fast lookup to check whether an element has appeared before. What would you usually reach for?", ["hash-set|HashSet", "stack|Stack", "queue|Queue", "linked-list|Linked List"], "hash-set"),
    "dsa-binary-search": question(section, "DSA pulse · quick pattern check", "Recognising the pattern", "You’re working with a sorted array and repeatedly cutting the search space in half. Which technique is this?", ["binary-search|Binary Search", "sliding-window|Sliding Window", "bfs|BFS", "backtracking|Backtracking"], "binary-search"),
    "dsa-tree-bfs": question(section, "DSA pulse · quick pattern check", "A tree, level by level", "You need to process a tree level by level. Which approach fits naturally?", ["bfs|BFS", "dfs|DFS", "two-pointers|Two Pointers", "dynamic-programming|Dynamic Programming"], "bfs"),
    "dsa-adaptive": question(section, "DSA pulse · one step deeper", "A contiguous range", "A contiguous subarray problem asks for the longest range satisfying a condition. What pattern would you consider first?", ["sliding-window|Sliding Window", "union-find|Union Find", "topological-sort|Topological Sort", "linked-list|Linked List"], "sliding-window"),
    engineering: question(section, "Engineering pulse · one scenario", "Investigate before changing things", "A new release doubles API latency for a small group of users. What is the most useful first move?", ["rollback-immediately|Roll back immediately without checking any telemetry", "inspect-segmented-telemetry|Inspect segmented traces and metrics, then isolate what changed", "increase-capacity|Increase infrastructure capacity for every user first"], "inspect-segmented-telemetry")
  };
  return questionVariant(section, role, questionId) ?? common[section];
}

export function isCorrectBaselineAnswer(section: BaselineSection, choiceId: string, role: Role, questionId?: string): boolean {
  return baselineQuestion(section, role, questionId).correctOptionId === choiceId;
}

export function nextBaselineSection(section: BaselineSection): BaselineSection | null {
  if (section === "dsa-familiarity") return "dsa-lookup";
  if (section === "dsa-lookup") return "dsa-binary-search";
  if (section === "dsa-binary-search") return "dsa-tree-bfs";
  if (section === "dsa-tree-bfs") return "dsa-adaptive";
  if (section === "dsa-adaptive") return "dsa-code-lookup";
  if (section === "dsa-code-lookup") return "dsa-code-binary-search";
  if (section === "dsa-code-binary-search") return "technical-1";
  if (section === "technical-1") return "technical-2";
  if (section === "technical-2") return "technical-3";
  if (section === "technical-3") return "engineering";
  if (section === "engineering") return "architecture";
  return null;
}

function question(section: BaselineQuestion["section"], eyebrow: string, title: string, prompt: string, options: string[], correctOptionId: string): BaselineQuestion {
  return { section, eyebrow, title, prompt, options: options.map((item) => { const [id, label] = item.split("|"); return { id: id!, label: label! }; }), correctOptionId };
}

function questionVariant(section: Exclude<BaselineSection, "dsa-familiarity" | "technical-1" | "technical-2" | "technical-3">, role: Role, questionId?: string): BaselineQuestion | null {
  const dsaSlot = section === "dsa-lookup" || section === "dsa-binary-search" || section === "dsa-tree-bfs" || section === "dsa-adaptive" ? section : null;
  const dsaIndex = questionId?.match(/^dsa-(?:lookup|binary-search|tree-bfs|adaptive)-(\d+)$/)?.[1];
  if (dsaSlot && dsaIndex !== undefined) {
    const selected = dsaBankQuestion(dsaSlot, Number(dsaIndex));
    if (selected) return { ...selected, section, eyebrow: "" };
  }
  const engineeringIndex = questionId?.match(/^engineering-(\d+)$/)?.[1];
  if (section === "engineering" && engineeringIndex !== undefined) {
    const selected = appliedEngineeringQuestion(Number(engineeringIndex));
    if (selected) return { ...selected, section, eyebrow: "" };
  }
  const aiMlEngineeringIndex = questionId?.match(/^ai-ml-engineering-(\d+)$/)?.[1];
  if (section === "engineering" && role === "ai-ml" && aiMlEngineeringIndex !== undefined) {
    const selected = aiMlAppliedEngineeringQuestion(Number(aiMlEngineeringIndex));
    if (selected) return { ...selected, section, eyebrow: "" };
  }
  const architectureIndex = questionId?.match(/^architecture-(\d+)$/)?.[1];
  if (section === "architecture" && architectureIndex !== undefined) {
    const selected = architectureQuestion(Number(architectureIndex));
    if (selected) return { ...selected, section, eyebrow: "" };
  }
  const aiMlArchitectureIndex = questionId?.match(/^ai-ml-architecture-(\d+)$/)?.[1];
  if (section === "architecture" && role === "ai-ml" && aiMlArchitectureIndex !== undefined) {
    const selected = aiMlArchitectureQuestion(Number(aiMlArchitectureIndex));
    if (selected) return { ...selected, section, eyebrow: "" };
  }
  const variants: Record<string, BaselineQuestion> = {
    "dsa-lookup-alt": question(section, "", "Fast lookup", "You need to count how often each word appears in a document. Which structure fits best?", ["hash-map|HashMap", "stack|Stack", "queue|Queue", "linked-list|Linked List"], "hash-map"),
    "dsa-binary-search-alt": question(section, "", "Recognising the pattern", "You need to find the first version that introduced a bug, and later versions stay broken. What approach fits?", ["binary-search|Binary Search", "sliding-window|Sliding Window", "bfs|BFS", "backtracking|Backtracking"], "binary-search"),
    "dsa-tree-bfs-alt": question(section, "", "A tree, level by level", "You want the minimum number of edges from a tree root to the first matching node. What approach fits naturally?", ["bfs|BFS", "dfs|DFS", "two-pointers|Two Pointers", "dynamic-programming|Dynamic Programming"], "bfs"),
    "dsa-adaptive-alt": question(section, "", "A contiguous range", "You need the shortest contiguous range whose sum reaches a threshold. What pattern would you consider first?", ["sliding-window|Sliding Window", "union-find|Union Find", "topological-sort|Topological Sort", "linked-list|Linked List"], "sliding-window"),
    "engineering-alt": question(section, "", "Investigate before changing things", "Queue delay rises for one region just after a deployment. What is the most useful first move?", ["restart-everything|Restart every worker everywhere", "inspect-regional-telemetry|Compare regional traces, queue depth, and the deployed change", "increase-capacity|Add capacity globally before inspecting evidence"], "inspect-regional-telemetry")
  };
  const selected = questionId ? variants[questionId] : undefined;
  return selected ? { ...selected, section } : null;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

function shuffled<T>(items: T[], seed: string): T[] {
  const next = [...items];
  let value = hash(seed);
  for (let index = next.length - 1; index > 0; index -= 1) {
    value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
    const other = value % (index + 1);
    [next[index], next[other]] = [next[other]!, next[index]!];
  }
  return next;
}

function technicalQuestion(role: Role, section: "technical-1" | "technical-2" | "technical-3", questionId?: string): BaselineQuestion {
  const choices: Record<Role, Array<[string, string, string, string]>> = {
    frontend: [
      ["An interface shows an old value after a user action. What should you check first?", "Whether state updates and derived values flow through the render correctly.", "Whether adding more CSS rules updates the component.", "Whether restarting the browser fixes the value."],
      ["The snippet does not reliably update the UI after saving a name. What should change?", "Create a new profile object when setting state, rather than mutating the existing one.", "Add more CSS rules to force a render.", "Restart the browser after every save."],
      ["A user sees stale data after a mutation. What makes the UI reliable?", "Invalidate or update the relevant cached data after the mutation succeeds.", "Wait for a browser refresh and hope it updates.", "Store the data only in a CSS variable."],
      ["A list becomes janky while filtering a large data set. What is the useful first step?", "Profile rendering work and identify which updates are expensive.", "Add a new animation to hide the delay.", "Move every component into one file."],
      ["A form sends a request twice when clicked quickly. What should be guarded?", "The submit path so an in-flight mutation cannot be started again.", "The font weight of the submit button.", "The browser history entry."],
      ["A component re-renders far more often than expected. What should you inspect before adding memoization?", "Which state or parent prop changes actually trigger the renders.", "The colour of the component border.", "Whether the browser cache is disabled."],
      ["A page fetches independent data one request after another. What improves the loading path?", "Start independent requests in parallel and wait for them together.", "Make every request synchronous.", "Add a longer loading spinner."],
      ["A browser-only API runs during server rendering. What is the safe boundary?", "Access it only in client-side code such as an effect or event handler.", "Call it while rendering on the server.", "Put it in a CSS file."],
      ["A long list must render smoothly while a user scrolls. What is a practical technique?", "Virtualise off-screen rows rather than mounting every row.", "Increase every row’s font size.", "Fetch the same list again on each scroll."]
    ],
    backend: [
      ["An endpoint becomes slow after a data table grows. What should you inspect first?", "The query plan and whether the access path still uses an appropriate index.", "Whether renaming the endpoint makes it faster.", "Add logs without examining the database or request path."],
      ["A client retries a create request after a timeout. What protects against duplicate records?", "An idempotency key or deduplication at the write boundary.", "Making the response JSON smaller.", "Restarting the database before every request."],
      ["A cached value is wrong only after an update. Where should you look?", "The invalidation or write-through path for that specific key.", "Increase the cache TTL for every key.", "Disable all observability."],
      ["A worker handles the same message after a retry. What should its write be?", "Idempotent for the message’s stable identifier.", "Dependent on the worker process name.", "Delayed until all other messages finish."],
      ["A request is failing only for one tenant. What narrows the issue fastest?", "Slice traces and metrics by tenant before changing global capacity.", "Scale every service immediately.", "Remove the tenant identifier from logs."],
      ["A transaction updates two related records but one must never persist without the other. What should define the write?", "A database transaction around the related changes.", "Two unrelated background jobs.", "A client-side timeout."],
      ["A downstream service is intermittently slow. What protects your own endpoint first?", "A bounded timeout with a clear fallback or failure path.", "Wait forever for the downstream response.", "Retry immediately without a limit."],
      ["A webhook provider may deliver the same event twice. What should you store?", "The provider event ID to deduplicate processing.", "Only the current server timestamp.", "The request’s CSS class."],
      ["A query returns more data than an endpoint needs. What is the first improvement?", "Select only required fields and paginate the result where appropriate.", "Serialize every column twice.", "Increase the response timeout."]
    ],
    fullstack: [
      ["A page feels slow even though its API is fast. What is the best next investigation?", "Profile rendering and network waterfalls to locate the bottleneck.", "Rewrite the API without measuring the page.", "Add animation to make the page feel faster."],
      ["A user sees stale data after saving a form. What should you check?", "Whether the mutation updates or invalidates the relevant client data.", "Whether the form has a brighter submit button.", "Whether the database table has a shorter name."],
      ["A retry after a network failure creates two records. What boundary needs protection?", "The server write with an idempotency key or deduplication rule.", "The page title in the browser tab.", "The CSS bundle size."],
      ["A page works locally but a production API call fails. Where does the investigation start?", "The deployed request, environment configuration, and browser network trace.", "A full rewrite of the client app.", "Changing the product copy."],
      ["A list flickers after an optimistic save fails. What makes recovery safe?", "Rollback or refetch the affected client state from the confirmed server result.", "Keep the optimistic value forever.", "Hide the error and stop future saves."],
      ["A user loses a form update during a slow network request. What boundary should own the confirmed state?", "The server response, with the client reconciling optimistic state to it.", "The browser tab title.", "A static HTML attribute."],
      ["An API response shape changed and the page now fails only for some users. What should you check?", "Versioned contracts and defensive handling of missing or changed fields.", "Only the page background.", "Whether more requests can be sent."],
      ["A page loads duplicate data from two components. What reduces the waste?", "Share or cache the request at the data-fetching boundary.", "Add a second identical request.", "Render both components more slowly."]
    ],
    data: [
      ["A daily pipeline reruns after a partial failure. What property matters most?", "Use an idempotent write or checkpoint so the rerun cannot duplicate output.", "Append every record again and clean up later.", "Skip the run so the pipeline cannot fail again."],
      ["This daily insert runs again after a partial failure. What should you change?", "Use a partitioned replace or merge keyed to the run date so reruns are safe.", "Append the same rows again and clean up later.", "Increase the batch size without adding a checkpoint."],
      ["A backfill must be safe to rerun. What should anchor the design?", "A deterministic key or partitioned checkpoint for each write.", "A manual spreadsheet of every record.", "A larger batch size without validation."],
      ["A source starts arriving two hours late. What should the pipeline make visible?", "Freshness and completeness signals for the affected partitions.", "Only the successful row count.", "A larger warehouse size."],
      ["Two pipelines define revenue differently. What reduces future disagreement?", "A shared metric definition with lineage and ownership.", "More copies of the dashboard.", "A separate spreadsheet for each team."],
      ["A schema adds a nullable source field. What keeps downstream models safe?", "Handle the new field explicitly and monitor null or unexpected values.", "Assume every historical row has the field.", "Drop the whole table immediately."],
      ["A job succeeds but produces half the expected rows. What should catch this?", "A volume or completeness assertion against an expected range.", "A larger log file.", "A longer retry delay."],
      ["A transformation is expensive but reused by several dashboards. What is a sensible design?", "Materialise or cache it at a governed shared layer.", "Recompute it independently in every dashboard.", "Copy it into untracked spreadsheets."]
    ],
    "ai-ml": [
      ["A model’s offline score improves but user outcomes do not. What should you examine?", "Compare offline evaluation with online outcomes and the live data distribution.", "Use a larger model before checking the evaluation setup.", "Remove the metrics because users are unpredictable."],
      ["A model starts failing for a recently common input type. What is a likely next check?", "Look for distribution shift in live inputs and slice the evaluation by that case.", "Train longer without inspecting examples.", "Hide the failures from monitoring."],
      ["A production model changes. What keeps a rollback possible?", "Version the model, prompts, and evaluation snapshot used for the release.", "Overwrite the previous model with no record.", "Only keep the new model’s name in a chat message."],
      ["Retrieval quality drops after a content refresh. What is the useful first slice?", "Compare retrieval results and source coverage before changing the model.", "Only raise the model temperature.", "Remove the content refresh history."],
      ["A model response is safe in tests but unsafe in production. What needs inspection?", "The live prompt path, input distribution, and safety evaluation slices.", "Only the model’s parameter count.", "The colour of the moderation dashboard."],
      ["A classifier’s precision improves while recall falls sharply. What should guide the next decision?", "The product cost of false positives and false negatives for the intended use.", "Whichever metric has the larger percentage.", "Only the training runtime."],
      ["A feature pipeline changes. What prevents training-serving skew?", "Use a versioned, shared feature definition and validate it in both paths.", "Recreate features manually in production.", "Ignore the serving implementation."],
      ["An LLM answer cites an irrelevant document. What should you inspect first?", "The retrieval ranking, query formulation, and source chunks.", "Only the model name.", "The chat bubble colour."],
      ["A ranking model has strong overall metrics but fails a key user segment. What should you do next?", "Evaluate and inspect metrics sliced by that segment.", "Average the segment into the global score.", "Remove the segment from logs."],
      ["A model is accurate but calibration is poor. What does that affect?", "Whether predicted confidence can support threshold-based decisions.", "Only model file size.", "The number of training epochs alone."],
      ["Offline A/B evaluation conflicts with live experimentation. Which signal decides product rollout?", "The pre-defined live user outcome with guardrails.", "Whichever offline metric is largest.", "A single anecdotal example."],
      ["A label set was produced by several annotators with disagreement. What should you measure?", "Inter-annotator agreement and ambiguous-label handling.", "Only the number of rows.", "GPU utilization."],
      ["A training set contains data from after the evaluation cutoff. What is the risk?", "Temporal leakage makes offline performance unrealistically optimistic.", "The model will always be smaller.", "Inference becomes impossible."],
      ["A feature is computed using information unavailable at prediction time. What is wrong?", "It leaks future information into the model.", "It has too few parameters.", "It needs a brighter dashboard."],
      ["A binary classifier has 99% accuracy on a rare-event task. What should you examine?", "Precision, recall, and the confusion matrix for the positive class.", "Only total accuracy.", "The model name."],
      ["A model has high recall but low precision. What is a likely product effect?", "It catches many positives but creates many false alarms.", "It never returns a result.", "It uses too little memory."],
      ["A threshold change improves conversion but increases unsafe outputs. What should constrain the decision?", "Safety guardrails and the cost of harmful false negatives.", "Only conversion rate.", "The newest model version."],
      ["Training metrics improve while validation loss worsens. What is a likely diagnosis?", "Overfitting to the training data.", "A guaranteed production improvement.", "A database schema problem."],
      ["A model performs well on random splits but poorly on newer data. What split should you add?", "A time-based evaluation split matching future deployment.", "More random duplicates.", "No held-out data."],
      ["A class is missing from the validation set. What does that prevent?", "Reliable evaluation of performance for that class.", "Model compilation.", "Saving model weights."],
      ["A model card reports one aggregate metric. What makes it more useful?", "Document data scope, slices, limitations, and intended use.", "Only add a larger title.", "Remove caveats."],
      ["A new feature changes live input distributions. What should be monitored?", "Feature and prediction drift against a reference distribution.", "Only request count.", "The model repository stars."],
      ["The training pipeline silently drops malformed examples. What should be added?", "Data-quality metrics and alerts for dropped-record rates.", "A longer training run.", "A different chart colour."],
      ["A model needs retraining every month. What should trigger it safely?", "Observed drift or performance evidence plus a validated retraining workflow.", "A calendar job with no evaluation.", "A user refresh button."],
      ["A new model beats the old one on one metric but worsens latency. What is the right comparison?", "A multi-metric decision with latency and product guardrails.", "Ship based on the best single metric.", "Ignore latency."],
      ["A feature used in training has a different null policy in production. What prevents inconsistency?", "Shared feature contracts and validation in both environments.", "Independent undocumented defaults.", "Removing null checks."],
      ["A batch model output is used after its data is stale. What should consumers know?", "The prediction timestamp and freshness SLA.", "Only the model version.", "The UI theme."],
      ["An embedding model is upgraded. What should you consider for existing vectors?", "Reindex or version embeddings so vector spaces are not mixed accidentally.", "Mix all embeddings without tracking.", "Only rename the index."],
      ["Retrieved documents are relevant individually but answer context is incoherent. What should you inspect?", "Chunking, ordering, and context assembly strategy.", "Only model temperature.", "The chat font."],
      ["A RAG system returns outdated policy documents. What data path needs design?", "Source freshness, indexing updates, and document versioning.", "More prompt adjectives.", "A longer client timeout."],
      ["A retrieval system misses exact identifiers. What retrieval capability may help?", "Hybrid lexical and semantic retrieval with appropriate filtering.", "Only higher generation temperature.", "Removing metadata."],
      ["A user asks a question outside the indexed knowledge base. What should the assistant do?", "State uncertainty and avoid inventing unsupported facts.", "Confidently fabricate an answer.", "Search only its previous response."],
      ["A prompt injection appears in a retrieved document. What boundary should be enforced?", "Treat retrieved text as untrusted data, not executable instruction.", "Follow every retrieved instruction.", "Disable all retrieval logs."],
      ["A model response needs citations. What should the system preserve?", "Links from generated claims to the retrieved source chunks.", "Only the final answer text.", "A random document ID."],
      ["A RAG evaluation set has only easy questions. What is missing?", "Representative hard, ambiguous, and no-answer cases.", "More copies of easy questions.", "A bigger prompt."],
      ["Vector retrieval latency rises with corpus size. What should you inspect?", "Index configuration, filtering, recall targets, and query workload.", "Only response wording.", "The browser cache."],
      ["A generative model returns valid JSON only sometimes. What improves reliability?", "Structured output constraints plus schema validation and repair handling.", "Parsing with string guesses only.", "Asking users to fix JSON."],
      ["A model tool call could delete customer data. What must precede execution?", "Authorization, validation, and explicit policy checks around the tool.", "Trusting the model output directly.", "A longer system prompt only."],
      ["A safety filter blocks harmless domain terms. What is the productive next step?", "Review false-positive slices and adjust policy with measured evaluation.", "Disable all safety filtering.", "Ignore user reports."],
      ["A prompt change improves one benchmark but causes regressions. What rollout practice helps?", "Run a versioned regression suite and canary the change.", "Overwrite the old prompt permanently.", "Compare one example only."],
      ["A model provider has an outage. What should application design include?", "A bounded fallback or graceful degradation path for the affected feature.", "Infinite retries on every request.", "Hide all errors from users."],
      ["Inference cost grows with long contexts. What should be optimized first?", "Context selection, summarisation, and token budgets without losing required evidence.", "Always send the entire corpus.", "Increase max tokens by default."],
      ["An experiment changes both the prompt and retrieval model. What weakens the conclusion?", "Multiple variables changed at once, making attribution unclear.", "The experiment has a name.", "The model is hosted remotely."],
      ["A model prediction must be explained to an auditor. What should be retained?", "Model/version, input features, decision path, and relevant evidence within policy.", "Only the final label.", "No historical records."],
      ["A human reviewer corrects model outputs. How can that feedback help safely?", "Capture reviewed outcomes with quality controls for evaluation and future training.", "Train immediately on every raw click.", "Discard all corrections."],
      ["Online feature values are delayed for some users. What should the serving path do?", "Use a documented fallback and record the missing-feature condition.", "Invent a random feature value.", "Fail silently without telemetry."],
      ["A model is deployed to a new geography. What should be validated?", "Language, data, policy, and performance slices relevant to that region.", "Only global aggregate accuracy.", "The server hostname."],
      ["A model’s confidence is high on unfamiliar inputs. What monitoring can reveal it?", "Out-of-distribution or embedding-distance signals alongside outcome slices.", "Only average latency.", "A larger batch size."],
      ["A recommendation model keeps showing the same items. What should be measured?", "Diversity, novelty, and user outcome trade-offs alongside relevance.", "Only click-through rate in aggregate.", "The number of model layers."],
      ["Training jobs are reproducible only sometimes. What should be versioned?", "Code, data snapshot, features, configuration, and environment.", "Only the model filename.", "The engineer’s local notes."],
      ["A model registry marks a model production-ready. What should that imply?", "It passed defined evaluation, approval, and deployment checks.", "It was trained most recently.", "It has the largest file size."],
      ["A new prompt exposes private data from prior context. What should be revisited?", "Context isolation, data-access policy, and redaction boundaries.", "Only the response temperature.", "The chat avatar."],
      ["An LLM agent loops on the same tool call. What guard should exist?", "Step limits, loop detection, and an observable stop/fallback path.", "Unlimited autonomous retries.", "A longer tool description only."],
      ["A vision model is accurate in daylight but fails at night. What evaluation improvement is needed?", "Slice evaluation by lighting and other relevant real-world conditions.", "Report only overall accuracy.", "Use more daytime images only."],
      ["A model’s output distribution shifts after a data-source change. What is a first response?", "Compare source changes, feature drift, and outcome metrics before retraining.", "Retrain blindly without inspection.", "Delete old monitoring."],
      ["A team wants to fine-tune on customer conversations. What must be resolved first?", "Consent, privacy, retention, and data-governance requirements.", "Only GPU availability.", "The new model name."],
      ["A model latency SLO is breached for long prompts. What design measurement matters?", "Latency percentiles segmented by prompt/context size and model path.", "Only average latency.", "A random sample of UI sessions."],
      ["A generation is fluent but factually wrong. What system-level remedy is most relevant?", "Ground it with verifiable evidence and evaluate factuality separately from fluency.", "Increase creativity settings.", "Remove citations."],
      ["A multi-model ensemble disagrees on an input. What can a safe product flow do?", "Use a disagreement threshold to defer, ask for review, or apply a fallback.", "Choose randomly without recording it.", "Hide disagreement from monitoring."]
    ],
    pm: [
      ["A feature has strong sign-ups but weak repeat use. What should you investigate next?", "Cohort retention and the point where people stop receiving value.", "Buy more acquisition before checking product behaviour.", "Ignore repeat use because the launch drove enough sign-ups."],
      ["A metric rose after launch. What tells you whether the change caused it?", "Compare with a meaningful baseline or controlled experiment.", "Assume timing proves causation.", "Ask only the launch team for feedback."],
      ["Users start a flow but rarely finish it. Where do you look first?", "The funnel step and user evidence around the largest drop-off.", "A new colour for the entire product.", "A higher sign-up target for the quarter."],
      ["A customer request is loud but uncommon. What should guide prioritisation?", "The affected segment, frequency, impact, and strategic context.", "The volume of a single conversation.", "Whoever sent the request most recently."],
      ["An experiment has a positive top-line metric but worse retention. What is the right read?", "Inspect the trade-off before calling the experiment a success.", "Ship immediately because one metric improved.", "Ignore retention until the next quarter."],
      ["A team wants to ship a broad solution before speaking with users. What is the useful next step?", "Test the riskiest assumption with targeted user evidence first.", "Build every requested feature before learning.", "Choose the longest roadmap item."],
      ["Activation is falling for a new cohort. What makes the investigation actionable?", "Segment the funnel and examine the first meaningful drop-off.", "Look only at total sign-ups.", "Change the logo before measuring behaviour."],
      ["A roadmap item has unclear success criteria. What should be defined before delivery?", "The target user behaviour, metric, and decision threshold.", "The final launch celebration.", "A larger feature name."]
    ]
  };
  const fallbackIndex = Number(section.slice(-1)) - 1;
  const selectedIndex = Number(questionId?.replace("technical-", ""));
  const [prompt, correct, second, third] = choices[role][Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < choices[role].length ? selectedIndex : fallbackIndex]!;
  return {
    ...question(section, "Technical pulse · stack-aware", "A quick technical decision", prompt, ["correct|" + correct, "distractor-1|" + second, "distractor-2|" + third], "correct"),
    code: technicalCode(role, section, questionId)
  };
}

/** Snippets are keyed by question ID, so code and question always describe the same issue. */
function technicalCode(role: Role, _section: "technical-1" | "technical-2" | "technical-3", questionId?: string): BaselineQuestion["code"] | undefined {
  const samples: Record<Role, Partial<Record<number, BaselineQuestion["code"]>>> = {
    frontend: {
      1: { language: "typescript", value: "function saveName(nextName: string) {\n  profile.name = nextName;\n  setProfile(profile);\n}" },
      2: { language: "typescript", value: "await updateProfile(values);\n// The profile query cache still holds the previous value." }
    },
    backend: {
      1: { language: "typescript", value: "const requestId = req.get(\"Idempotency-Key\")!;\nconst order = await db.order.upsert({\n  where: { requestId },\n  create: { ...req.body, requestId },\n  update: {}\n});" },
      2: { language: "typescript", value: "await db.user.update({ where: { id }, data: input });\nreturn cache.get(`user:${id}`); // may still be stale" }
    },
    fullstack: {
      1: { language: "typescript", value: "await api.updateProfile(values);\n// The profile query is not invalidated or updated here." },
      2: { language: "typescript", value: "const order = await db.order.upsert({\n  where: { requestId },\n  create: { ...input, requestId },\n  update: {}\n});\n// requestId has a UNIQUE constraint in the database." }
    },
    data: {
      1: { language: "sql", value: "INSERT INTO daily_revenue\nSELECT run_date, SUM(amount)\nFROM payments\nGROUP BY run_date;" },
      2: { language: "sql", value: "-- This job may be run again after a partial failure\nINSERT INTO customer_events\nSELECT * FROM staged_events;" }
    },
    "ai-ml": {
      0: { language: "typescript", value: "const report = evaluate(model, offlineDataset);\nif (report.accuracy > 0.9) deploy(model);\n// No live-input slices are checked." },
      2: { language: "typescript", value: "registry.set(\"production\", newModel);\n// The previous model and evaluation snapshot are not recorded." }
    },
    pm: {}
  };
  const selectedIndex = Number(questionId?.replace("technical-", ""));
  return Number.isInteger(selectedIndex) ? samples[role][selectedIndex] : undefined;
}
