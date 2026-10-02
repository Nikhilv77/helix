import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { canViewInterviewOperations } from "@/features/interviews/server/interview-operations-access";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getAppContainer, type AppContainer } from "@/server/app-container";

/**
 * Every admin page calls this before reading anything. It reuses the single
 * admin id that already guards interview operations, and anyone else gets the
 * same 404 as a page that does not exist.
 */
export async function requireAdmin(): Promise<AppContainer> {
  const { userId } = await auth();
  const app = getAppContainer();
  const ownerId = userId ? authenticatedOwnerId(userId) : null;
  if (!canViewInterviewOperations(app.config, ownerId)) notFound();
  return app;
}
