import type { CandidateSkillSignal } from "@/features/preparation-onboarding/domain/preparation-onboarding";
import type { PreparationAreaId } from "@/features/preparation-onboarding/domain/preparation-areas";
import type { ReportsOverview } from "@/lib/reports/reports";
import type { ProgressDashboardOverview } from "@/lib/roadmap/progress";
import type { CandidateProfile, Role } from "@/lib/shared/types";

export type BaselinePriorityMode = "strengthen" | "measure" | "verify";

export interface BaselinePriority {
  areaId: PreparationAreaId;
  areaLabel: string;
  label: string;
  mode: BaselinePriorityMode;
}

export interface BaselineStrength {
  areaId: PreparationAreaId;
  label: string;
  broadDsaSignal: boolean;
}

const AREA_LABELS: Record<PreparationAreaId, string> = {
  dsa: "DSA problem solving",
  "core-technical": "Core technical depth",
  "applied-engineering": "Applied engineering judgment",
  "architecture-design": "Architecture and design"
};

const ROLE_AREA_ORDER: Record<Role, PreparationAreaId[]> = {
  frontend: ["core-technical", "dsa", "applied-engineering", "architecture-design"],
  backend: ["dsa", "core-technical", "applied-engineering", "architecture-design"],
  fullstack: ["dsa", "core-technical", "applied-engineering", "architecture-design"],
  data: ["core-technical", "applied-engineering", "architecture-design", "dsa"],
  "ai-ml": ["core-technical", "applied-engineering", "architecture-design", "dsa"],
  pm: ["core-technical", "applied-engineering", "architecture-design", "dsa"]
};

export function buildBaselinePriorities(profile: CandidateProfile): BaselinePriority[] {
  const skillProfile = profile.preparationOnboarding?.skillProfile;
  if (!skillProfile?.signals.length) return [];

  const role = profile.targetRole ?? "backend";
  const areaOrder = ROLE_AREA_ORDER[role];
  const orderedSignals = [...skillProfile.signals].sort(
    (left, right) => areaOrder.indexOf(left.areaId) - areaOrder.indexOf(right.areaId)
  );
  const buckets: Record<BaselinePriorityMode, BaselinePriority[]> = {
    strengthen: [],
    measure: [],
    verify: []
  };

  for (const signal of orderedSignals) {
    const priorities = prioritiesFromSignal(signal);
    for (const priority of priorities) buckets[priority.mode].push(priority);
  }

  return [...buckets.strengthen, ...buckets.measure, ...buckets.verify];
}

export function buildBaselineStrengths(profile: CandidateProfile): BaselineStrength[] {
  const signals = profile.preparationOnboarding?.skillProfile?.signals;
  if (!signals?.length) return [];

  const role = profile.targetRole ?? "backend";
  const areaOrder = ROLE_AREA_ORDER[role];
  const orderedSignals = [...signals].sort(
    (left, right) => areaOrder.indexOf(left.areaId) - areaOrder.indexOf(right.areaId)
  );
  const strengths: BaselineStrength[] = [];

  for (const signal of orderedSignals) {
    if (signal.evidence !== "baseline") continue;
    const topics = signal.topics ?? [];
    const familiar = topics.filter((topic) => topic.familiarity === "familiar");
    const needsRefresh = topics.filter((topic) => topic.familiarity === "needs-refresh");
    const broadDsaSignal =
      signal.areaId === "dsa" && familiar.length >= 3 && familiar.length > needsRefresh.length;

    if (broadDsaSignal) {
      strengths.push({
        areaId: signal.areaId,
        label: "algorithms and data structures",
        broadDsaSignal: true
      });
      continue;
    }

    for (const topic of familiar) {
      strengths.push({ areaId: signal.areaId, label: topic.label, broadDsaSignal: false });
    }

    if (
      familiar.length === 0 &&
      needsRefresh.length === 0 &&
      signal.startingState === "experienced-active"
    ) {
      strengths.push({
        areaId: signal.areaId,
        label: AREA_LABELS[signal.areaId],
        broadDsaSignal: signal.areaId === "dsa"
      });
    }
  }

  return strengths;
}

function prioritiesFromSignal(signal: CandidateSkillSignal): BaselinePriority[] {
  const areaLabel = AREA_LABELS[signal.areaId];
  if (signal.evidence === "not-enough-evidence") {
    return [{ areaId: signal.areaId, areaLabel, label: areaLabel, mode: "measure" }];
  }

  const topics = signal.topics ?? [];
  const needsRefresh = topics
    .filter((topic) => topic.familiarity === "needs-refresh")
    .map((topic) => ({
      areaId: signal.areaId,
      areaLabel,
      label: topic.label,
      mode: "strengthen" as const
    }));
  if (needsRefresh.length > 0) return needsRefresh;

  if (
    signal.startingState === "needs-foundations" ||
    signal.startingState === "experienced-rusty" ||
    signal.startingState === "some-familiarity"
  ) {
    return [{ areaId: signal.areaId, areaLabel, label: areaLabel, mode: "strengthen" }];
  }

  const familiar = topics.find((topic) => topic.familiarity === "familiar");
  if (familiar) {
    return [{ areaId: signal.areaId, areaLabel, label: familiar.label, mode: "verify" }];
  }

  return [
    {
      areaId: signal.areaId,
      areaLabel,
      label: areaLabel,
      mode: signal.startingState === "experienced-active" ? "verify" : "measure"
    }
  ];
}

export function baselineAction(
  priority: BaselinePriority,
  practice: ProgressDashboardOverview | null
): { href: string; direct: boolean } {
  const next = practice?.nextUp;
  if (!next) return { href: "/practice", direct: false };

  const priorityKey = normalizedFocus(priority.label);
  const matches = [next.chapterTitle, next.title]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizedFocus(value) === priorityKey);
  return matches ? { href: next.href, direct: true } : { href: "/practice", direct: false };
}

export function baselineFocusDetail(priority: BaselinePriority): string {
  if (priority.mode === "strengthen") {
    return `Your starting signal suggests ${priority.label} needs a refresh. Use one focused block to verify and strengthen it.`;
  }
  if (priority.mode === "measure") {
    return "The baseline did not collect enough evidence here. A focused attempt will make the next recommendation sharper.";
  }
  return "The baseline suggests familiarity here. Test it at greater depth before moving on.";
}

export function normalizedFocus(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isFreshEvidenceState(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null
): boolean {
  if (!reports || !practice) return false;
  return (
    !currentCycleRounds(profile, reports).some(
      (round) => round.answerCount > 0 || round.evidenceScore !== null
    ) &&
    !currentCycleLatest(profile, reports) &&
    practice.totals.totalAttempts === 0 &&
    practice.totals.completedQuestions === 0
  );
}

export function isBaselineCalibrationPhase(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null
): boolean {
  if (!reports || !practice || buildBaselinePriorities(profile).length === 0) return false;
  const hasInterviewAnswer = currentCycleRounds(profile, reports).some(
    (round) => round.answerCount > 0 || round.evidenceScore !== null
  );
  return !hasInterviewAnswer && practice.totals.completedQuestions === 0;
}

export function isActionableInterview(
  profile: CandidateProfile,
  round: ReportsOverview["rounds"][number]
): boolean {
  // Legacy profiles predate the baseline flow, so preserve their existing resume behavior.
  // Once a baseline exists, merely opening a room is not stronger evidence than completing it.
  return baselineCutoff(profile) === null || round.answerCount > 0;
}

export function baselineCutoff(profile: CandidateProfile): number | null {
  const onboarding = profile.preparationOnboarding;
  const generatedAt = onboarding?.skillProfile?.generatedAt ?? null;
  const completedAt = onboarding?.completedAt ?? null;
  if (generatedAt === null) return completedAt;
  if (completedAt === null) return generatedAt;
  return Math.max(generatedAt, completedAt);
}

export function currentCycleRounds(
  profile: CandidateProfile,
  reports: ReportsOverview | null
): ReportsOverview["rounds"] {
  if (!reports) return [];
  const cutoff = baselineCutoff(profile);
  if (cutoff === null) return reports.rounds;
  return reports.rounds.filter(
    (round) => !Number.isFinite(round.startedAt) || round.startedAt >= cutoff
  );
}

export function currentCycleLatest(
  profile: CandidateProfile,
  reports: ReportsOverview | null
): ReportsOverview["latest"] {
  if (!reports) return null;
  const cutoff = baselineCutoff(profile);
  if (cutoff === null) return reports.latest;
  return currentCycleRounds(profile, reports).find((round) => round.evidenceScore !== null) ?? null;
}

export function currentCycleReadiness(
  profile: CandidateProfile,
  reports: ReportsOverview
): { score: number | null; delta: number | null; scoredRounds: number } {
  if (baselineCutoff(profile) === null) {
    return {
      score: reports.readinessScore,
      delta: reports.scoreDelta,
      scoredRounds: reports.scoredRounds
    };
  }

  const scores = currentCycleRounds(profile, reports)
    .filter(
      (round): round is typeof round & { evidenceScore: number } => round.evidenceScore !== null
    )
    .sort((left, right) => left.startedAt - right.startedAt)
    .map((round) => round.evidenceScore);
  const recent = scores.slice(-5);
  const score = recent.length
    ? Math.round(recent.reduce((total, value) => total + value, 0) / recent.length)
    : null;
  const first = scores[0] ?? null;
  const latest = scores.at(-1) ?? null;
  return {
    score,
    delta: first !== null && latest !== null && scores.length > 1 ? latest - first : null,
    scoredRounds: scores.length
  };
}

export function profilePriorities(profile: CandidateProfile): string[] {
  const candidates = [
    ...profile.focusAreas,
    ...(profile.resume?.roadmap.map((item) => item.title) ?? []),
    ...(profile.resume?.practiceQuestions.map((item) => item.competency) ?? []),
    ...(profile.resume?.skills ?? [])
  ];
  const seen = new Set<string>();
  const priorities: string[] = [];

  for (const candidate of candidates) {
    const value = candidate.replace(/\s+/g, " ").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    priorities.push(value);
    if (priorities.length === 2) break;
  }

  return priorities;
}
