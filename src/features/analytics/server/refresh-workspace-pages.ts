import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import type { WorkspacePage } from "./workspace-page-snapshot.store";
import { buildInterviewsHomeForOwner } from "@/features/interviews/server/load-interviews-home";
import { buildResumeRoastPageData } from "@/features/resume-roast/server/resume-roast-page-data";
import { buildTrailmatePageData } from "@/features/peer-help/server/trailmate-page-data";
import { buildReportsPageData } from "@/features/reports/server/reports-page-data";

const logger = new Logger("WorkspacePageRefresh");
// Prepare database-only pages first; interview planning can invoke AI and use
// most of the post-response budget on a newly onboarded account.
const pages: WorkspacePage[] = ["reports", "resume-roast", "trailmate", "interviews"];

export async function refreshWorkspacePage(ownerId: string, page: WorkspacePage): Promise<void> {
  const store = getAppContainer().workspacePageSnapshotStore;
  switch (page) {
    case "interviews":
      await store.readOrBuild(ownerId, page, () => buildInterviewsHomeForOwner(ownerId), {
        requireFresh: true
      });
      break;
    case "resume-roast":
      await store.readOrBuild(ownerId, page, () => buildResumeRoastPageData(ownerId), {
        requireFresh: true
      });
      break;
    case "trailmate":
      await store.readOrBuild(ownerId, page, () => buildTrailmatePageData(ownerId), {
        requireFresh: true
      });
      break;
    case "reports":
      await store.readOrBuild(ownerId, page, () => buildReportsPageData(ownerId), {
        requireFresh: true
      });
      break;
  }
}

/** Prepare first views after onboarding without making the page navigation do it. */
export async function refreshWorkspacePagesAfterOnboarding(ownerId: string): Promise<void> {
  for (const page of pages) {
    try {
      await refreshWorkspacePage(ownerId, page);
    } catch (error) {
      logger.error({
        event: "workspace_page_preparation_failed",
        ownerId,
        page,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
