import type { WorkspaceAccent } from "@/lib/shared/types";

/** Settings shown on Manage, without the full resume or profile JSON. */
export interface ManageAccountProfile {
  workspaceAccent: WorkspaceAccent;
  teacherId: string | null;
  profileImage: string | null;
  resumeFullName: string | null;
  teacherNotificationsEnabled: boolean;
  helpNotificationsEnabled: boolean;
}
