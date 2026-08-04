import { DashboardSkeleton } from "@/components/workspace/skeletons";

/** Shown while the workspace home resolves its quota, history and insights. */
export default function HomeLoading() {
  return <DashboardSkeleton />;
}
