import { handleCallback } from "@vercel/queue";
import { z } from "zod";

import { getAppContainer } from "@/server/app-container";

export const runtime = "nodejs";

const messageSchema = z
  .object({
    version: z.literal(1),
    notificationId: z.string().uuid()
  })
  .strict();

/** Private Vercel Queue consumer; experimentalTriggers removes its public URL. */
export const POST = handleCallback<unknown>(
  async (message) => {
    const parsed = messageSchema.parse(message);
    await getAppContainer().notificationDispatcher.retryOne(parsed.notificationId);
  },
  {
    retry: (_error, metadata) =>
      metadata.deliveryCount >= 4 ? { acknowledge: true } : { afterSeconds: 60 }
  }
);
