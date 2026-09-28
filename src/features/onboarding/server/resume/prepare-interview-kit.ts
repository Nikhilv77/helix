import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";

const logger = new Logger("PrepareInterviewKit");

/**
 * Writes the resume interview kit ahead of time, so the first Resume or
 * Technical round starts without waiting on a model call. Runs after a
 * response; a failure only means that round generates the kit itself.
 */
export async function prepareInterviewKit(ownerId: string): Promise<void> {
  try {
    const app = getAppContainer();
    const profile = await app.profileService.get(ownerId);
    if (!profile.resume) return;
    await app.resumeInterviewKitService.ensure({
      ownerId,
      resume: profile.resume,
      targetRole: profile.targetRole ?? "frontend",
      level: profile.level ?? "0-2"
    });
  } catch (error) {
    logger.warn(
      JSON.stringify({
        event: "resume.kit.prepare_failed",
        reason: error instanceof Error ? error.message : "unknown error"
      })
    );
  }
}
