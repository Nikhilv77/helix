import { AI_ML_ARCHITECTURE_SCENARIOS } from "./ai-ml-scenarios";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "./reviewed-scenarios";

/** All authored cases share one Architecture engine; only approved cases may be published. */
export const ARCHITECTURE_DESIGN_CONTENT_CANDIDATES = Object.freeze([
  ...ARCHITECTURE_DESIGN_REVIEW_CANDIDATES,
  ...AI_ML_ARCHITECTURE_SCENARIOS
]);
