import { clerkClient } from "@clerk/nextjs/server";

import { Logger } from "../common/logger";
import { ownerIdToUserId } from "../interview/owner";
import type { AddressBook } from "./email-channel";

const logger = new Logger("ClerkAddressBook");

/**
 * Resolves an owner id to an email address.
 *
 * Addresses live in Clerk, not in our database, and that is worth keeping: an
 * address the product never stores is one it cannot leak, and Clerk stays the
 * single record of who someone is. The cost is a network call per email, which
 * is fine at the rate notifications are actually sent.
 *
 * Returns null rather than throwing for every failure mode — no such user, no
 * verified address, Clerk unreachable. The caller degrades to the in-app inbox,
 * which has already been written by this point.
 */
export const clerkAddressBook: AddressBook = async (ownerId: string) => {
  const userId = ownerIdToUserId(ownerId);
  if (!userId) return null;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const address = user.primaryEmailAddress?.emailAddress;

    // Sending to an unverified address is how a domain's sending reputation
    // gets spent on somebody who never asked for the mail.
    if (!address || user.primaryEmailAddress?.verification?.status !== "verified") {
      return null;
    }

    return address;
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "clerk.address.lookup.failed",
        reason: error instanceof Error ? error.message : String(error)
      })
    );
    return null;
  }
};
