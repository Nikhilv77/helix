import type { Prisma } from "@prisma/client";

/** Serialize old MCQ and current story writes for the same candidate. */
export async function lockAiMlPracticeOwner(tx: Prisma.TransactionClient, ownerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-ml-practice:${ownerId}`}))`;
}
