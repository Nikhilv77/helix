/**
 * Stable import boundary for roadmap consumers. Implementation lives in the
 * feature module so reads, provisioning, and progress work can evolve without
 * leaking its internal layout to routes or the application container.
 */
export { FrontendRoadmapService } from "./frontend-roadmap/service";
export type {
  EnsureFrontendRoadmapResult,
  RoadmapQuestionAttemptAction
} from "./frontend-roadmap/types";
