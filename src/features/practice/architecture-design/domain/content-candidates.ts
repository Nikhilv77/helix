import { AI_ML_ARCHITECTURE_SCENARIOS } from "./ai-ml-scenarios";
import type { ArchitectureDesignTrack } from "./contracts";
import { DATA_ARCHITECTURE_SCENARIOS, DATA_INTERVIEW_ONLY_SCENARIO_KEYS } from "./data-scenarios";
import {
  FRONTEND_ARCHITECTURE_SCENARIOS,
  FRONTEND_INTERVIEW_ONLY_SCENARIO_KEYS
} from "./frontend-scenarios";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "./reviewed-scenarios";

/** All authored cases share one Architecture engine; only approved cases may be published. */
export const ARCHITECTURE_DESIGN_CONTENT_CANDIDATES = Object.freeze([
  ...ARCHITECTURE_DESIGN_REVIEW_CANDIDATES,
  ...AI_ML_ARCHITECTURE_SCENARIOS,
  ...FRONTEND_ARCHITECTURE_SCENARIOS,
  ...DATA_ARCHITECTURE_SCENARIOS
]);

/**
 * Reviewed scenarios reserved for the System Design interview. Practice never
 * offers them, so a learner who practises every path still meets a design they
 * have not seen, with a reference answer they have not read.
 */
export const ARCHITECTURE_DESIGN_INTERVIEW_ONLY_SCENARIO_KEYS: ReadonlySet<string> = new Set([
  ...FRONTEND_INTERVIEW_ONLY_SCENARIO_KEYS,
  ...DATA_INTERVIEW_ONLY_SCENARIO_KEYS
]);

const TRACK_BY_SCENARIO_KEY: ReadonlyMap<string, ArchitectureDesignTrack> = new Map([
  ...FRONTEND_ARCHITECTURE_SCENARIOS.map(
    (artifact) => [artifact.scenario.key, "frontend"] as const
  ),
  ...DATA_ARCHITECTURE_SCENARIOS.map((artifact) => [artifact.scenario.key, "data"] as const)
]);

/** The kind of system a scenario designs; unknown keys are server scenarios. */
export function architectureDesignTrackForScenario(scenarioKey: string): ArchitectureDesignTrack {
  return TRACK_BY_SCENARIO_KEY.get(scenarioKey) ?? "server";
}
