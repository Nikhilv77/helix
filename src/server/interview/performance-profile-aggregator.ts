import { createHash } from "node:crypto";
import {
  BEHAVIORAL_DIMENSIONS,
  CANDIDATE_PERFORMANCE_PROFILE_SCHEMA_VERSION,
  PROBLEM_SOLVING_SKILL_KEY,
  behavioralSkillKey,
  dsaPatternSkillKey,
  parseCandidatePerformanceProfile,
  type BehavioralDimension,
  type CandidatePerformanceProfile,
  type DemonstratedRubricPerformance,
  type DemonstratedSkillProfile
} from "@/lib/interviews/performance-profile";
import type { BlueprintDifficulty } from "@/lib/interviews/personalized-plan";
import { findQuestion } from "@/lib/dsa/dsa";
import { createInterviewReport } from "./report";
import type { StoredInterviewSession } from "./session-store";
import type { InterviewState, PlannedQuestion } from "./types";

interface PerformanceObservation {
  skillKey: string;
  topicKey: string;
  rubricKeys: string[];
  score: number;
  observedAt: number;
  sessionId: string;
}

export interface AggregateCandidatePerformanceInput {
  id: string;
  revision: number;
  sessions: StoredInterviewSession[];
  generatedAt?: number;
  sourceSessionFingerprint?: string;
}

/** The original personalized-only filter remains available to older callers. */
export function completedPersonalizedSessions(
  sessions: StoredInterviewSession[]
): StoredInterviewSession[] {
  return sessions
    .filter(({ state }) => {
      if (
        state.phase !== "done" ||
        !state.setup.personalizedPlanId ||
        !state.setup.personalizedBlueprint
      ) {
        return false;
      }
      return state.plan.some(
        (question, index) =>
          question.topicKey &&
          state.turns.some(
            (turn) => turn.speaker === "user" && turn.questionIndex === index && turn.text.trim()
          )
      );
    })
    .sort((left, right) => left.state.startedAt - right.state.startedAt);
}

/**
 * Completed sessions that carry trustworthy adaptive evidence. Personalized
 * blueprints contribute technical skills, while the two authored specialized
 * rounds contribute problem-solving and behavioral dimensions.
 */
export function completedAdaptiveSessions(
  sessions: StoredInterviewSession[]
): StoredInterviewSession[] {
  return sessions
    .filter(({ state }) => {
      if (state.phase !== "done") return false;
      const answered = answeredQuestionIndexes(state);
      if (!answered.size) return false;

      if (isTrustedPersonalizedSession(state)) {
        return state.plan.some((question, index) => answered.has(index) && question.topicKey);
      }
      if (isDsaSession(state)) {
        return Boolean(state.setup.dsaQuestionSlugs?.some((_slug, index) => answered.has(index)));
      }
      if (isResumeBehavioralSession(state)) {
        return state.plan.some((question, index) => answered.has(index) && question.kind !== "mcq");
      }
      return false;
    })
    .sort((left, right) => left.state.startedAt - right.state.startedAt);
}

export function performanceSourceFingerprint(sessions: StoredInterviewSession[]): string {
  const sources = completedAdaptiveSessions(sessions).map(({ state }) => ({
    sessionId: state.id,
    sourceKind: performanceSourceKind(state),
    templateId: state.setup.templateId ?? null,
    planId: state.setup.personalizedPlanId,
    blueprintId: state.setup.personalizedBlueprint?.id,
    dsaQuestionSlugs: state.setup.dsaQuestionSlugs ?? [],
    answers: state.turns
      .filter((turn) => turn.speaker === "user")
      .map((turn) => ({
        questionIndex: turn.questionIndex ?? null,
        endMs: turn.endMs,
        text: turn.text
      })),
    grades: state.turns
      .filter((turn) => turn.speaker === "agent" && typeof turn.correct === "boolean")
      .map((turn) => ({ questionIndex: turn.gradedQuestionIndex ?? null, correct: turn.correct })),
    questionEvaluations: state.questionEvaluations ?? {},
    codeExecutions: state.codeExecutions ?? {}
  }));
  return `sha256-${createHash("sha256").update(JSON.stringify(sources)).digest("hex")}`;
}

/**
 * Folds question-level evidence from personalized, DSA, and resume/behavioral
 * sessions into one immutable profile.
 */
export function aggregateCandidatePerformanceProfile(
  input: AggregateCandidatePerformanceInput
): CandidatePerformanceProfile | null {
  const sessions = completedAdaptiveSessions(input.sessions);
  if (!sessions.length) return null;
  const generatedAt = input.generatedAt ?? Date.now();
  const observations = sessions.flatMap((session) => observationsForSession(session, generatedAt));
  if (!observations.length) return null;

  const skillsByKey = groupBy(observations, (observation) => observation.skillKey);
  const skills = [...skillsByKey.entries()]
    .map(([skillKey, values]) => skillProfile(skillKey, values, generatedAt))
    .sort((left, right) => left.skillKey.localeCompare(right.skillKey));
  const answeredQuestionCount = sessions.reduce(
    (total, { state }) =>
      total +
      new Set(
        state.turns
          .filter((turn) => turn.speaker === "user" && typeof turn.questionIndex === "number")
          .map((turn) => turn.questionIndex)
      ).size,
    0
  );

  return parseCandidatePerformanceProfile({
    schemaVersion: CANDIDATE_PERFORMANCE_PROFILE_SCHEMA_VERSION,
    id: input.id,
    revision: input.revision,
    sourceSessionFingerprint:
      input.sourceSessionFingerprint ?? performanceSourceFingerprint(sessions),
    generatedAt,
    completedSessionCount: sessions.length,
    answeredQuestionCount,
    sourceSessionIds: sessions.map(({ state }) => state.id),
    skills
  });
}

function observationsForSession(
  session: StoredInterviewSession,
  now: number
): PerformanceObservation[] {
  if (isDsaSession(session.state)) return dsaObservationsForSession(session, now);
  if (isResumeBehavioralSession(session.state)) {
    return behavioralObservationsForSession(session, now);
  }

  const report = createInterviewReport(session, now);
  const { state } = session;

  return state.plan.flatMap((question, index) => {
    const competency = report.competencies[index];
    if (
      !competency?.answered ||
      !question.topicKey ||
      state.questionEvaluations?.[String(index)]?.source === "evaluation-unavailable"
    ) {
      return [];
    }
    const skillKeys = unique(question.skillKeys?.length ? question.skillKeys : [question.topicKey]);
    const score = questionScore(state, question, index, competency.evidenceScore);
    const observedAt = Math.max(
      state.startedAt,
      ...state.turns
        .filter((turn) => turn.speaker === "user" && turn.questionIndex === index)
        .map((turn) => state.startedAt + turn.endMs)
    );

    return skillKeys.map((skillKey) => ({
      skillKey,
      topicKey: question.topicKey!,
      rubricKeys: unique(question.rubricKeys ?? []),
      score,
      observedAt,
      sessionId: state.id
    }));
  });
}

function dsaObservationsForSession(
  session: StoredInterviewSession,
  now: number
): PerformanceObservation[] {
  const report = createInterviewReport(session, now);
  const { state } = session;

  return (state.setup.dsaQuestionSlugs ?? []).flatMap((slug, index) => {
    const competency = report.competencies[index];
    const question = state.plan[index];
    const dsaQuestion = findQuestion(slug)?.question;
    if (
      !competency?.answered ||
      !question ||
      !dsaQuestion ||
      state.questionEvaluations?.[String(index)]?.source === "evaluation-unavailable"
    ) {
      return [];
    }

    const topicKey = `dsa:${dsaQuestion.primaryPattern}`;
    const score = questionScore(
      state,
      {
        ...question,
        blueprintDifficulty: dsaBlueprintDifficulty(dsaQuestion.difficulty)
      },
      index,
      competency.evidenceScore
    );
    const observedAt = observationTime(state, index);
    const common = {
      topicKey,
      rubricKeys: ["reasoning", "correctness", "communication"],
      score,
      observedAt,
      sessionId: state.id
    };

    return [
      { ...common, skillKey: PROBLEM_SOLVING_SKILL_KEY },
      { ...common, skillKey: dsaPatternSkillKey(dsaQuestion.primaryPattern) }
    ];
  });
}

function behavioralObservationsForSession(
  session: StoredInterviewSession,
  now: number
): PerformanceObservation[] {
  const report = createInterviewReport(session, now);
  const { state } = session;

  return state.plan.flatMap((question, index) => {
    const competency = report.competencies[index];
    const breakdown = competency?.evidenceBreakdown;
    if (!competency?.answered || !breakdown || question.kind === "mcq") return [];

    const dimensions = behavioralDimensionsFor(question);
    const followUpPenalty = Math.min(8, followUpCount(state, index) * 2);
    const observedAt = observationTime(state, index);
    const topicKey = `behavioral:${question.stage ?? "experience"}`;

    return dimensions.map((dimension) => ({
      skillKey: behavioralSkillKey(dimension),
      topicKey,
      rubricKeys: [dimension],
      score: clampScore(breakdown[dimension] - followUpPenalty),
      observedAt,
      sessionId: state.id
    }));
  });
}

function behavioralDimensionsFor(question: PlannedQuestion): BehavioralDimension[] {
  if (question.stage === "code" || question.kind === "code") {
    return ["decision", "specificity"];
  }
  if (question.stage === "skills") {
    return ["ownership", "decision", "specificity"];
  }
  return [...BEHAVIORAL_DIMENSIONS];
}

function dsaBlueprintDifficulty(difficulty: "easy" | "medium" | "hard"): BlueprintDifficulty {
  if (difficulty === "easy") return "foundational";
  if (difficulty === "hard") return "advanced";
  return "intermediate";
}

function observationTime(state: StoredInterviewSession["state"], questionIndex: number): number {
  return Math.max(
    state.startedAt,
    ...state.turns
      .filter((turn) => turn.speaker === "user" && turn.questionIndex === questionIndex)
      .map((turn) => state.startedAt + turn.endMs)
  );
}

function followUpCount(state: StoredInterviewSession["state"], questionIndex: number): number {
  return state.turns.filter(
    (turn) =>
      turn.speaker === "agent" &&
      turn.questionIndex === questionIndex &&
      (turn.action === "probe" || turn.action === "challenge" || turn.action === "clarify")
  ).length;
}

function questionScore(
  state: StoredInterviewSession["state"],
  question: PlannedQuestion,
  questionIndex: number,
  evidenceScore: number
): number {
  const evaluation = state.questionEvaluations?.[String(questionIndex)];
  if (evaluation) return clampScore(evaluation.score);

  const graded = state.turns.find(
    (turn) =>
      turn.speaker === "agent" &&
      turn.gradedQuestionIndex === questionIndex &&
      typeof turn.correct === "boolean"
  );
  const followUps = state.turns.filter(
    (turn) =>
      turn.speaker === "agent" &&
      turn.questionIndex === questionIndex &&
      (turn.action === "probe" || turn.action === "challenge" || turn.action === "clarify")
  ).length;
  // A complete answer that needed no probe is meaningful evidence even when
  // it is conceptual and does not contain resume-report keywords or metrics.
  const conversationalScore = followUps === 0 ? Math.max(72, evidenceScore) : evidenceScore;
  const base = graded ? (graded.correct ? 90 : 35) : conversationalScore;
  return clampScore(base + difficultyModifier(question.blueprintDifficulty));
}

function answeredQuestionIndexes(state: InterviewState): Set<number> {
  return new Set(
    state.turns
      .filter(
        (turn) =>
          turn.speaker === "user" &&
          typeof turn.questionIndex === "number" &&
          turn.text.trim().length > 0
      )
      .map((turn) => turn.questionIndex!)
  );
}

function isTrustedPersonalizedSession(state: InterviewState): boolean {
  return Boolean(state.setup.personalizedPlanId && state.setup.personalizedBlueprint);
}

function isDsaSession(state: InterviewState): boolean {
  return (
    state.setup.templateId === "dsa" ||
    state.setup.templateTitle === "DSA practice interview"
  );
}

function isResumeBehavioralSession(state: InterviewState): boolean {
  return state.setup.resumeRound === true || state.setup.templateId === "resume-behavioral-defense";
}

function performanceSourceKind(state: InterviewState): "personalized" | "dsa" | "behavioral" {
  if (isDsaSession(state)) return "dsa";
  if (isResumeBehavioralSession(state)) return "behavioral";
  return "personalized";
}

function difficultyModifier(difficulty: BlueprintDifficulty | undefined): number {
  if (difficulty === "foundational") return -4;
  if (difficulty === "advanced") return 4;
  return 0;
}

function skillProfile(
  skillKey: string,
  observations: PerformanceObservation[],
  generatedAt: number
): DemonstratedSkillProfile {
  const ordered = observations.slice().sort((left, right) => left.observedAt - right.observedAt);
  const weightedScore = weightedAverage(
    ordered.map((observation) => ({
      value: observation.score,
      weight: recencyWeight(observation.observedAt, generatedAt)
    }))
  );
  const distinctSessions = new Set(ordered.map((observation) => observation.sessionId)).size;
  const spread =
    Math.max(...ordered.map(({ score }) => score)) - Math.min(...ordered.map(({ score }) => score));
  const confidence = clamp01(
    0.35 +
      Math.min(5, ordered.length) * 0.1 +
      Math.min(3, distinctSessions) * 0.08 -
      Math.min(0.2, spread / 200)
  );

  return {
    skillKey,
    score: roundScore(weightedScore),
    confidence: roundConfidence(confidence),
    sampleSize: ordered.length,
    lastObservedAt: Math.max(...ordered.map(({ observedAt }) => observedAt)),
    trend:
      ordered.length > 1
        ? roundScore(ordered[ordered.length - 1]!.score - ordered[0]!.score)
        : null,
    topicKeys: unique(ordered.map(({ topicKey }) => topicKey)),
    rubricPerformance: rubricPerformance(ordered)
  };
}

function rubricPerformance(
  observations: PerformanceObservation[]
): DemonstratedRubricPerformance[] {
  const byRubric = groupBy(
    observations.flatMap((observation) =>
      observation.rubricKeys.map((rubricKey) => ({
        rubricKey,
        score: observation.score
      }))
    ),
    (observation) => observation.rubricKey
  );
  return [...byRubric.entries()]
    .map(([rubricKey, values]) => ({
      rubricKey,
      score: roundScore(values.reduce((sum, value) => sum + value.score, 0) / values.length),
      sampleSize: values.length
    }))
    .sort((left, right) => left.rubricKey.localeCompare(right.rubricKey));
}

function recencyWeight(observedAt: number, now: number): number {
  const ageDays = Math.max(0, now - observedAt) / (24 * 60 * 60 * 1_000);
  return Math.max(0.35, 1 - ageDays / 730);
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const weight = values.reduce((sum, item) => sum + item.weight, 0);
  if (weight <= 0) return 0;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / weight;
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), value]);
  }
  return groups;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundConfidence(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
