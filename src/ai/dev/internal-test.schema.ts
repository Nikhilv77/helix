import { z } from "zod";

export const internalStructuredOutputTestSchema = z.object({
  ok: z.boolean(),
  summary: z.string().min(1),
  checklist: z.array(z.string().min(1)).min(1)
});

export type InternalStructuredOutputTest = z.infer<typeof internalStructuredOutputTestSchema>;
