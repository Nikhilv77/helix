import type {
  InterviewCompetencyReport,
  InterviewHistoryItem,
  InterviewHistoryStatus,
  InterviewReport,
  WorkspaceCompetency,
  WorkspaceInsights
} from "@/lib/shared/types";
import { SESSION_TTL_MS, type StoredInterviewSession } from "./session-store";
import type { QuestionEvaluation } from "./types";

export function createHistoryItem(
  session: StoredInterviewSession,
  now = Date.now()
): InterviewHistoryItem {
  const { state, touchedAt } = session;
  const userTurns = state.turns.filter((turn) => turn.speaker === "user");
  const covered = new Set(
    userTurns
      .map((turn) => turn.questionIndex)
      .filter((index): index is number => typeof index === "number")
  );

  return {
    sessionId: state.id,
    status: getStatus(state.phase, touchedAt, now),
    setup: state.setup,
    startedAt: state.startedAt,
    updatedAt: touchedAt,
    durationMs: getDurationMs(session, now),
    questionCount: state.plan.length,
    questionsCovered: covered.size,
    answerCount: userTurns.length
  };
}

export function createInterviewReport(
  session: StoredInterviewSession,
  now = Date.now()
): InterviewReport {
  const { state } = session;
  const history = createHistoryItem(session, now);
  const agentTurns = state.turns.filter((turn) => turn.speaker === "agent");
  const competencies: InterviewCompetencyReport[] = state.plan.map((question, index) => {
    const answers = state.turns.filter(
      (turn) => turn.speaker === "user" && turn.questionIndex === index
    );
    const answer = answers[0];
    const heuristicAssessment = assessAnswer(
      question.kind ?? "conversation",
      answers.map((turn) => turn.text),
      agentTurns.filter((turn) => turn.questionIndex === index).map((turn) => turn.action)
    );
    const evaluation = state.questionEvaluations?.[String(index)];
    const assessment = evaluation
      ? assessedTechnicalAnswer(heuristicAssessment, evaluation)
      : heuristicAssessment;

    return {
      label: question.competency?.trim() || `Question ${index + 1}`,
      question: question.text,
      evidenceAnchor: question.evidenceAnchor ?? null,
      answered: Boolean(answer),
      answerPreview: answer ? compact(answers.map((turn) => turn.text).join(" "), 180) : null,
      ...assessment
    };
  });
  const codeQuestionIndex = state.plan.findIndex((question) => question.kind === "code");
  const codeQuestion = codeQuestionIndex >= 0 ? state.plan[codeQuestionIndex] : null;
  const codeAnswer = state.turns.find(
    (turn) => turn.speaker === "user" && turn.questionIndex === codeQuestionIndex
  );
  const codeExecution =
    codeQuestionIndex >= 0 ? state.codeExecutions?.[String(codeQuestionIndex)] : undefined;
  const codeEvaluation =
    codeQuestionIndex >= 0 ? state.questionEvaluations?.[String(codeQuestionIndex)] : undefined;

  const answeredCompetencies = competencies.filter((item) => item.answered);
  const scoredCompetencies = answeredCompetencies.filter(
    (item) => item.technicalEvaluation?.source !== "evaluation-unavailable"
  );
  const ordered = [...scoredCompetencies].sort(
    (left, right) => right.evidenceScore - left.evidenceScore
  );
  const strongest = ordered[0] ?? null;
  const recommended = ordered.at(-1) ?? competencies[0] ?? null;
  const evidenceScore = scoredCompetencies.length
    ? Math.round(
        scoredCompetencies.reduce((total, item) => total + item.evidenceScore, 0) /
          scoredCompetencies.length
      )
    : 0;

  return {
    ...history,
    competencies,
    interaction: {
      probes: agentTurns.filter((turn) => turn.action === "probe").length,
      challenges: agentTurns.filter((turn) => turn.action === "challenge").length,
      clarifications: agentTurns.filter((turn) => turn.action === "clarify").length,
      interruptions: agentTurns.filter((turn) => turn.action === "interrupt").length
    },
    codeExercise: codeQuestion
      ? {
          language: codeQuestion.language?.trim() || "Code",
          task: codeQuestion.codeTask?.trim() || codeQuestion.text,
          submitted: Boolean(codeAnswer?.text.trim()),
          execution: codeExecution
            ? {
                status: codeExecution.status,
                accepted: codeExecution.accepted,
                testsPassed: codeExecution.testsPassed,
                testCount: codeExecution.testCount
              }
            : null,
          correctnessScore:
            codeEvaluation?.source === "evaluation-unavailable"
              ? null
              : (codeEvaluation?.score ?? null)
        }
      : null,
    summary: {
      evidenceScore,
      strongest: strongest?.label ?? null,
      recommendedFocus: recommended?.label ?? null,
      nextStep:
        recommended?.nextStep ?? "Complete an interview to generate a targeted practice step."
    },
    transcript: state.turns
  };
}

export function createWorkspaceInsights(
  sessions: StoredInterviewSession[],
  now = Date.now()
): WorkspaceInsights {
  const reports = sessions
    .map((session) => createInterviewReport(session, now))
    .filter((report) => report.answerCount > 0);
  const completedSessions = reports.filter((report) => report.status === "completed").length;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const sessionsThisWeek = reports.filter((report) => report.startedAt >= weekAgo).length;
  const answeredQuestions = reports.reduce((total, report) => total + report.questionsCovered, 0);
  const groups = new Map<string, { label: string; scores: number[] }>();

  for (const report of reports) {
    for (const competency of report.competencies.filter(
      (item) =>
        item.answered && item.technicalEvaluation?.source !== "evaluation-unavailable"
    )) {
      const key = normaliseCompetency(competency.label);
      const existing = groups.get(key) ?? { label: competency.label, scores: [] };
      existing.scores.push(competency.evidenceScore);
      groups.set(key, existing);
    }
  }

  const competencyMap: WorkspaceCompetency[] = [...groups.values()]
    .map(({ label, scores }) => {
      // The durable store returns newest sessions first.
      const latest = scores[0] ?? 0;
      const previous = scores.length > 1 ? (scores[1] ?? latest) : latest;
      return {
        label,
        score: Math.round(scores.reduce((total, score) => total + score, 0) / scores.length),
        attempts: scores.length,
        trend: latest - previous
      };
    })
    .sort((left, right) => right.attempts - left.attempts || right.score - left.score)
    .slice(0, 6);
  const byScore = [...competencyMap].sort((left, right) => right.score - left.score);
  const readinessScore = reports.length
    ? Math.round(
        reports.slice(0, 5).reduce((total, report) => total + report.summary.evidenceScore, 0) /
          Math.min(reports.length, 5)
      )
    : null;

  return {
    readinessScore,
    completedSessions,
    sessionsThisWeek,
    answeredQuestions,
    competencyMap,
    strongest: byScore[0] ?? null,
    recommendedFocus: byScore.at(-1) ?? null
  };
}

function getStatus(
  phase: StoredInterviewSession["state"]["phase"],
  touchedAt: number,
  now: number
): InterviewHistoryStatus {
  if (phase === "done") return "completed";
  return now - touchedAt > SESSION_TTL_MS ? "expired" : "in_progress";
}

function getDurationMs(session: StoredInterviewSession, now: number): number {
  const latestTurn = Math.max(0, ...session.state.turns.map((turn) => turn.endMs));
  if (session.state.phase === "done" || now - session.touchedAt > SESSION_TTL_MS) {
    return latestTurn;
  }

  return Math.max(latestTurn, now - session.state.startedAt);
}

function compact(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trimEnd()}…` : normalized;
}

function assessAnswer(
  kind: "conversation" | "code" | "mcq",
  answers: string[],
  interviewerActions: Array<string | undefined>
): Pick<
  InterviewCompetencyReport,
  "evidenceScore" | "evidenceLevel" | "evidenceBreakdown" | "signals" | "gap" | "nextStep"
> {
  const text = answers.join(" ").replace(/\s+/g, " ").trim();
  if (!text) {
    return {
      evidenceScore: 0,
      evidenceLevel: "missing",
      signals: [],
      gap: "No answer evidence was captured.",
      nextStep: "Retry this question and give one concrete example from your own work."
    };
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  const signals: string[] = [];
  let score = 28 + Math.min(28, Math.round(words / 4));
  const hasSpecifics = /\b\d+(?:\.\d+)?(?:%|ms|s|x|k|m|gb|tb)?\b/i.test(text);
  const hasOwnership = /\b(i|my|i'm|i've|i'd)\b/i.test(text);
  const hasDecision = /\b(because|chose|decided|instead|trade[- ]?off|alternative|reason)\b/i.test(
    text
  );
  const hasOutcome =
    /\b(result|impact|improved|reduced|increased|saved|grew|measured|outcome)\b/i.test(text);
  const hasCode =
    kind === "code" && /[{}()[\];]|\b(function|class|const|def|return|select)\b/i.test(text);

  if (hasSpecifics) {
    score += 12;
    signals.push("Concrete numbers or constraints");
  }
  if (hasOwnership) {
    score += 8;
    signals.push("Personal ownership");
  }
  if (hasDecision) {
    score += 10;
    signals.push("Decision rationale");
  }
  if (hasOutcome) {
    score += 10;
    signals.push("Outcome or measurement");
  }
  if (hasCode) {
    score += 8;
    signals.push("Implementation detail");
  }

  const followUps = interviewerActions.filter((action) =>
    ["probe", "challenge", "clarify"].includes(action ?? "")
  ).length;
  const evidenceBreakdown = {
    ownership: hasOwnership ? 88 : 28,
    decision: hasDecision ? 86 : 30,
    specificity: hasSpecifics ? 84 : Math.min(72, 30 + Math.round(words / 5)),
    outcome: hasOutcome ? 86 : 26
  };
  score = Math.max(
    20,
    Math.min(
      100,
      Math.round(
        Object.values(evidenceBreakdown).reduce((total, value) => total + value, 0) /
          Object.values(evidenceBreakdown).length
      ) - Math.min(8, followUps * 2)
    )
  );

  const missing = [
    !hasOwnership ? "Make your personal contribution explicit." : null,
    !hasDecision ? "Explain why you chose this approach over an alternative." : null,
    !hasSpecifics ? "Add a concrete constraint, number, or technical detail." : null,
    !hasOutcome ? "Close with a measurable result or what you learned." : null
  ].filter((item): item is string => Boolean(item));

  return {
    evidenceScore: score,
    evidenceLevel: score >= 75 ? "strong" : "developing",
    evidenceBreakdown,
    signals,
    gap: missing[0] ?? "The answer contains a complete evidence chain.",
    nextStep: missing[0] ?? "Practice delivering the same evidence in a tighter 60-second response."
  };
}

function assessedTechnicalAnswer(
  heuristic: ReturnType<typeof assessAnswer>,
  evaluation: QuestionEvaluation
): ReturnType<typeof assessAnswer> & Pick<InterviewCompetencyReport, "technicalEvaluation"> {
  const gap = evaluation.gaps[0] ?? evaluation.summary;
  return {
    ...heuristic,
    evidenceScore: evaluation.score,
    evidenceLevel:
      evaluation.verdict === "insufficient-evidence"
        ? "missing"
        : evaluation.score >= 75
          ? "strong"
          : "developing",
    signals: evaluation.strengths,
    gap,
    nextStep: evaluation.gaps.length
      ? `Correct this technical gap: ${gap}`
      : "Practice explaining the same correct mechanism more concisely.",
    technicalEvaluation: {
      source: evaluation.source,
      score: evaluation.score,
      verdict: evaluation.verdict,
      confidence: evaluation.confidence,
      summary: evaluation.summary,
      strengths: evaluation.strengths,
      gaps: evaluation.gaps,
      rubricScores: evaluation.rubricScores,
      execution: evaluation.execution
        ? {
            status: evaluation.execution.status,
            accepted: evaluation.execution.accepted,
            testsPassed: evaluation.execution.testsPassed,
            testCount: evaluation.execution.testCount
          }
        : null
    }
  };
}

function normaliseCompetency(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
