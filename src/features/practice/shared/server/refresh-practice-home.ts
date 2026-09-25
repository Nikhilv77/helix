import { after } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { refreshCandidateAnalytics } from "@/features/analytics/server/refresh-candidate-analytics";

const logger = new Logger("PracticeHomeRefresh");

/** Run after a successful response; the database trigger protects the read path meanwhile. */
export function schedulePracticeHomeRefresh(ownerId: string): void {
  after(() => refreshPracticeHome(ownerId));
}

type RefreshRun = { promise: Promise<void>; again: boolean };
const running = new Map<string, RefreshRun>();

/**
 * Coalesces rebuilds per owner on this instance: writes that land while a
 * rebuild runs share one trailing rebuild instead of each starting their own.
 */
export function refreshPracticeHome(ownerId: string): Promise<void> {
  const current = running.get(ownerId);
  if (current) {
    current.again = true;
    return current.promise;
  }
  const run: RefreshRun = { promise: Promise.resolve(), again: false };
  run.promise = (async () => {
    try {
      do {
        run.again = false;
        await refreshPracticeHomeOnce(ownerId);
      } while (run.again);
    } finally {
      running.delete(ownerId);
    }
  })();
  running.set(ownerId, run);
  return run.promise;
}

async function refreshPracticeHomeOnce(ownerId: string): Promise<void> {
  let eligible = false;
  try {
    const app = getAppContainer();
    // Source-table triggers already mark the snapshot dirty. Bumping the
    // version again here can race a page rebuild and force it to start over.
    const profile = await app.profileService.get(ownerId);
    if (!profile.onboardingCompletedAt || !profile.preparationOnboarding.completedAt) return;
    eligible = true;
    const { loadPracticeHomeView } =
      await import("@/features/practice/shared/server/practice-home-loader");
    await app.practiceHomeSnapshotStore.readOrBuild(
      ownerId,
      () => loadPracticeHomeView(ownerId, profile),
      { requireFresh: true }
    );
  } catch (error) {
    logger.error({
      event: "practice.home_refresh_failed",
      ownerId,
      reason: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (eligible) await refreshCandidateAnalytics(ownerId);
  }
}
