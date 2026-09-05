import { describe, expect, it } from "vitest";
import { DSA_QUESTION_BANK, dsaQuestionMeta } from "@/lib/preparation/dsa-question-bank";
import { APPLIED_ENGINEERING_QUESTION_BANK } from "@/lib/preparation/applied-engineering-question-bank";
import { ARCHITECTURE_QUESTION_BANK } from "@/lib/preparation/architecture-question-bank";
import { AI_ML_APPLIED_ENGINEERING_QUESTION_BANK } from "@/lib/preparation/ai-ml-applied-engineering-question-bank";
import { AI_ML_ARCHITECTURE_QUESTION_BANK } from "@/lib/preparation/ai-ml-architecture-question-bank";
import {
  baselineQuestion,
  CORE_TECHNICAL_QUESTION_COUNTS,
  selectBaselineQuestionIds
} from "@/lib/preparation/preparation-onboarding";
import {
  initialPreparationOnboardingState,
  publicPreparationOnboardingState,
  recordBaselineAnswer,
  startBaseline
} from "./preparation-onboarding-state";

describe("preparation onboarding baseline", () => {
  it("draws from a fifty-question DSA bank while keeping the candidate's draw stable", () => {
    const count = Object.values(DSA_QUESTION_BANK).reduce((total, questions) => total + questions.length, 0);
    expect(count).toBe(50);
    expect(selectBaselineQuestionIds("candidate-a", "backend")).toEqual(selectBaselineQuestionIds("candidate-a", "backend"));
  });

  it("draws three distinct questions from the selected role's Core Technical bank", () => {
    expect(CORE_TECHNICAL_QUESTION_COUNTS.frontend).toBe(9);
    expect(CORE_TECHNICAL_QUESTION_COUNTS["ai-ml"]).toBe(59);
    const draw = selectBaselineQuestionIds("candidate-a", "frontend");
    expect(new Set([draw["technical-1"], draw["technical-2"], draw["technical-3"]]).size).toBe(3);
  });

  it("mixes foundation reasoning and LeetCode-style DSA prompts, then reserves the adaptive check for intermediate difficulty", () => {
    const draw = selectBaselineQuestionIds("candidate-a", "backend");
    const index = (section: "dsa-lookup" | "dsa-binary-search" | "dsa-tree-bfs" | "dsa-adaptive") => Number(draw[section]!.split("-").at(-1));
    expect(dsaQuestionMeta("dsa-lookup", index("dsa-lookup"))).toEqual({ kind: "leetcode", difficulty: "foundation" });
    expect(dsaQuestionMeta("dsa-binary-search", index("dsa-binary-search"))).toEqual({ kind: "reasoning", difficulty: "foundation" });
    expect(dsaQuestionMeta("dsa-adaptive", index("dsa-adaptive")).difficulty).toBe("intermediate");
  });

  it("reserves DSA code for the final two matched code-reading checks", () => {
    const normalBinary = baselineQuestion("dsa-binary-search", "backend", "dsa-binary-search-0");
    expect(normalBinary.code).toBeUndefined();

    const lookupCode = baselineQuestion("dsa-code-lookup", "backend", "dsa-code-lookup-v1");
    expect(lookupCode.code?.value).toContain("seen.has(event.id)");
    expect(lookupCode.prompt).toContain("seen.has(event.id)");

    const binaryCode = baselineQuestion("dsa-code-binary-search", "backend", "dsa-code-binary-search-v1");
    expect(binaryCode.code?.value).toContain("nums[mid] < target");
    expect(binaryCode.prompt).toContain("nums[mid] is smaller than target");

    const frontendPerformance = baselineQuestion("technical-2", "frontend", "technical-0");
    expect(frontendPerformance.code).toBeUndefined();
    const frontendMutation = baselineQuestion("technical-2", "frontend", "technical-1");
    expect(frontendMutation.code?.value).toContain("setProfile(profile)");

    const idempotentWrite = baselineQuestion("technical-3", "fullstack", "technical-2");
    expect(idempotentWrite.code?.value).toContain("db.order.upsert");
    expect(idempotentWrite.code?.value).not.toContain("findFirst");

    const breadthFirst = baselineQuestion("dsa-tree-bfs", "backend", "dsa-tree-bfs-0");
    expect(breadthFirst.code).toBeUndefined();
    expect(breadthFirst.prompt).toContain("one level at a time");
  });

  it("draws the engineering scenario from a fifty-question Applied Engineering bank", () => {
    expect(APPLIED_ENGINEERING_QUESTION_BANK).toHaveLength(50);
    expect(selectBaselineQuestionIds("candidate-a", "backend").engineering).toMatch(/^engineering-\d+$/);
  });

  it("draws the architecture scenario from a fifty-question Architecture & Design bank", () => {
    expect(ARCHITECTURE_QUESTION_BANK).toHaveLength(50);
    expect(selectBaselineQuestionIds("candidate-a", "backend").architecture).toMatch(/^architecture-\d+$/);
  });

  it("gives AI/ML candidates dedicated Engineering and Architecture scenarios", () => {
    expect(AI_ML_APPLIED_ENGINEERING_QUESTION_BANK).toHaveLength(50);
    expect(AI_ML_ARCHITECTURE_QUESTION_BANK).toHaveLength(50);
    const draw = selectBaselineQuestionIds("candidate-ai", "ai-ml");
    expect(draw.engineering).toMatch(/^ai-ml-engineering-\d+$/);
    expect(draw.architecture).toMatch(/^ai-ml-architecture-\d+$/);

    expect(baselineQuestion("engineering", "ai-ml", draw.engineering).prompt.toLowerCase())
      .toMatch(/model|feature|retriev|prompt|agent|inference|data|training|safety|embedding/);
    expect(baselineQuestion("architecture", "ai-ml", draw.architecture).prompt.toLowerCase())
      .toMatch(/model|feature|retriev|prompt|agent|inference|data|training|safety|embedding/);
  });

  it("upgrades an unasked legacy AI/ML shared scenario before the candidate reaches it", () => {
    const state = startBaseline(
      {
        ...initialPreparationOnboardingState(10),
        stage: "baseline_technical_3",
        questionIds: { "technical-3": "technical-0", engineering: "engineering-12", architecture: "architecture-18" }
      },
      "ai-ml",
      "candidate-ai",
      20
    );
    expect(state.questionIds.engineering).toBe("ai-ml-engineering-12");
    expect(state.questionIds.architecture).toBe("ai-ml-architecture-18");
  });

  it("uses six DSA checks, with two code-reading checks at the end, without inventing a score", () => {
    let state = startBaseline({ ...initialPreparationOnboardingState(10), stage: "baseline_intro" }, "backend", "candidate-a", 20);
    state = answer(state, "dsa-familiarity", "regular", 30);
    state = answer(state, "dsa-lookup", correct(state, "dsa-lookup"), 40);
    state = answer(state, "dsa-binary-search", correct(state, "dsa-binary-search"), 50);
    state = answer(state, "dsa-tree-bfs", correct(state, "dsa-tree-bfs"), 60);

    expect(state.stage).toBe("baseline_dsa_adaptive");
    state = answer(state, "dsa-adaptive", correct(state, "dsa-adaptive"), 70);
    expect(state.stage).toBe("baseline_dsa_code_lookup");
    state = answer(state, "dsa-code-lookup", correct(state, "dsa-code-lookup"), 80);
    expect(state.stage).toBe("baseline_dsa_code_binary_search");
    state = answer(state, "dsa-code-binary-search", correct(state, "dsa-code-binary-search"), 90);
    state = answer(state, "technical-1", correct(state, "technical-1"), 100);
    state = answer(state, "technical-2", correct(state, "technical-2"), 110);
    state = answer(state, "technical-3", correct(state, "technical-3"), 120);
    state = answer(state, "engineering", correct(state, "engineering"), 130);
    expect(state.stage).toBe("baseline_architecture");
    state = answer(state, "architecture", correct(state, "architecture"), 140);

    expect(state.stage).toBe("completed");
    expect(state.completedAt).toBe(140);
    expect(state.skillProfile?.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ areaId: "dsa", score: null, startingState: "experienced-active" }),
      expect.objectContaining({ areaId: "core-technical", score: null, evidence: "baseline" }),
      expect.objectContaining({ areaId: "architecture-design", score: null, evidence: "baseline" })
    ]));
  });

  it("keeps the DSA pulse consistent even when a candidate is still building foundations", () => {
    let state = startBaseline({ ...initialPreparationOnboardingState(10), stage: "baseline_intro" }, "backend", "candidate-b", 20);
    state = answer(state, "dsa-familiarity", "new", 30);
    state = answer(state, "dsa-lookup", wrong(state, "dsa-lookup"), 40);
    state = answer(state, "dsa-binary-search", wrong(state, "dsa-binary-search"), 50);
    state = answer(state, "dsa-tree-bfs", wrong(state, "dsa-tree-bfs"), 60);

    expect(state.stage).toBe("baseline_dsa_adaptive");
  });

  it("lets objective DSA evidence set the path bounds instead of self-report alone", () => {
    const humblePerfect = completeBackendBaseline("new");
    const confidentMixed = completeBackendBaseline(
      "regular",
      new Set(["dsa-tree-bfs", "dsa-adaptive"])
    );

    expect(dsaSignal(humblePerfect)?.startingState).toBe("experienced-active");
    expect(dsaSignal(confidentMixed)?.startingState).toBe("experienced-rusty");
  });

  it("requires both code-reading checks before marking code reading familiar", () => {
    const state = completeBackendBaseline(
      "regular",
      new Set(["dsa-code-binary-search"])
    );

    expect(
      dsaSignal(state)?.topics?.find((topic) => topic.label === "Code reading")?.familiarity
    ).toBe("needs-refresh");
  });

  it("starts AI/ML candidates at the stack-aware technical pulse rather than DSA", () => {
    const state = startBaseline(
      { ...initialPreparationOnboardingState(10), stage: "baseline_intro" },
      "ai-ml",
      "candidate-ai",
      20
    );

    expect(state.stage).toBe("baseline_technical_1");
    expect(state.questions["dsa-familiarity"]).toBeUndefined();
    expect(state.questions["technical-1"]).toEqual(
      expect.objectContaining({
        prompt: baselineQuestion("technical-1", "ai-ml", state.questionIds["technical-1"]).prompt
      })
    );
  });

  it("snapshots the exact assigned question set when the baseline starts", () => {
    const state = startBaseline(
      { ...initialPreparationOnboardingState(10), stage: "baseline_intro" },
      "backend",
      "candidate-a",
      20
    );

    expect(state.questions["dsa-code-lookup"]?.code?.value).toContain("seen.has(event.id)");
    expect(state.questions.architecture?.correctOptionId).toMatch(/^choice-\d+$/);
    expect(state.questions.architecture?.options.every((option) => /^choice-\d+$/.test(option.id))).toBe(true);
    expect(
      Object.values(state.questions).some((question) =>
        question?.correctOptionId !== "choice-1"
      )
    ).toBe(true);
  });

  it("removes answer keys from public state without changing frozen question content", () => {
    const state = startBaseline(
      { ...initialPreparationOnboardingState(10), stage: "baseline_intro" },
      "backend",
      "candidate-a",
      20
    );

    const publicState = publicPreparationOnboardingState(state);

    expect(publicState.questions["dsa-lookup"]).toMatchObject({
      prompt: state.questions["dsa-lookup"]?.prompt,
      options: state.questions["dsa-lookup"]?.options
    });
    expect(publicState.questions["dsa-lookup"]).not.toHaveProperty("correctOptionId");
    expect(state.questions["dsa-lookup"]?.correctOptionId).toBeTruthy();
  });

  it("keeps AI/ML technical draws within ML and production-AI concerns", () => {
    const prompts = Array.from({ length: CORE_TECHNICAL_QUESTION_COUNTS["ai-ml"] }, (_, index) =>
      baselineQuestion("technical-1", "ai-ml", `technical-${index}`).prompt.toLowerCase()
    );

    expect(prompts.join(" ")).toMatch(/model|retrieval|prompt|feature|classifier/);
    expect(prompts.join(" ")).not.toMatch(/page|render|css|component/);
  });
});

function answer(
  state: ReturnType<typeof initialPreparationOnboardingState>,
  section: Parameters<typeof recordBaselineAnswer>[2],
  choiceId: string,
  at: number
) {
  return recordBaselineAnswer(state, "backend", section, { choiceId, answeredAt: at }, at);
}

function correct(state: ReturnType<typeof initialPreparationOnboardingState>, section: Parameters<typeof recordBaselineAnswer>[2]): string {
  return state.questions[section]!.correctOptionId!;
}

function wrong(state: ReturnType<typeof initialPreparationOnboardingState>, section: Parameters<typeof recordBaselineAnswer>[2]): string {
  const question = state.questions[section]!;
  return question.options.find((option) => option.id !== question.correctOptionId)!.id;
}

function completeBackendBaseline(
  familiarity: "regular" | "rusty" | "some" | "new",
  wrongSections = new Set<string>()
) {
  let state = startBaseline(
    { ...initialPreparationOnboardingState(10), stage: "baseline_intro" },
    "backend",
    `candidate-${familiarity}-${[...wrongSections].join("-")}`,
    20
  );
  state = answer(state, "dsa-familiarity", familiarity, 30);

  const assessedSections = [
    "dsa-lookup",
    "dsa-binary-search",
    "dsa-tree-bfs",
    "dsa-adaptive",
    "dsa-code-lookup",
    "dsa-code-binary-search",
    "technical-1",
    "technical-2",
    "technical-3",
    "engineering",
    "architecture"
  ] as const;
  assessedSections.forEach((section, index) => {
    state = answer(
      state,
      section,
      wrongSections.has(section) ? wrong(state, section) : correct(state, section),
      40 + index * 10
    );
  });
  return state;
}

function dsaSignal(state: ReturnType<typeof initialPreparationOnboardingState>) {
  return state.skillProfile?.signals.find((signal) => signal.areaId === "dsa");
}
