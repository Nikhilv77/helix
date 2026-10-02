import { clerkClient } from "@clerk/nextjs/server";

import { authenticatedOwnerId, ownerIdToUserId } from "@/features/interviews/server/owner";
import { Logger } from "@/server/common/logger";

const logger = new Logger("AdminDirectory");

export interface AdminPerson {
  name: string | null;
  email: string | null;
  imageUrl: string | null;
}

/**
 * Names and emails live in Clerk, not in our database. The admin pages look
 * them up per page of results, and degrade to the bare id if Clerk is down.
 */
export async function peopleByOwnerId(ownerIds: string[]): Promise<Map<string, AdminPerson>> {
  const userIds = ownerIds.map(ownerIdToUserId).filter((id): id is string => Boolean(id));
  const people = new Map<string, AdminPerson>();
  if (!userIds.length) return people;
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ userId: userIds, limit: userIds.length });
    for (const user of data) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || null;
      people.set(authenticatedOwnerId(user.id), {
        name,
        email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
        imageUrl: user.hasImage ? user.imageUrl : null
      });
    }
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "admin.directory.lookup.failed",
        reason: error instanceof Error ? error.message : String(error)
      })
    );
  }
  return people;
}

/** Owner ids whose Clerk name, email, or username matches the search. */
export async function searchOwnerIds(query: string): Promise<string[]> {
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ query, limit: 100 });
    return data.map((user) => authenticatedOwnerId(user.id));
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "admin.directory.search.failed",
        reason: error instanceof Error ? error.message : String(error)
      })
    );
    return [];
  }
}
