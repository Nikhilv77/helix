import { revalidateTag, unstable_cache } from "next/cache";
import { getAppContainer } from "@/server/app-container";

const DSA_PAGE_PROGRESS_CACHE_VERSION = "dsa-page-progress-v1";

function progressTag(ownerId: string): string {
  return `dsa-page-progress:${ownerId}`;
}

/** Reuse the owner's roadmap projection until a question attempt changes it. */
export function cachedDsaPage(ownerId: string) {
  return unstable_cache(
    (id: string) => getAppContainer().frontendRoadmapService.dsaPage(id),
    [DSA_PAGE_PROGRESS_CACHE_VERSION],
    { tags: [progressTag(ownerId)], revalidate: 3_600 }
  )(ownerId);
}

/** Route handlers call this after a committed attempt, before returning success. */
export function invalidateDsaPage(ownerId: string): void {
  revalidateTag(progressTag(ownerId), { expire: 0 });
}
