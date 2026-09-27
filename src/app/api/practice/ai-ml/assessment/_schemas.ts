import { z } from "zod";

export const storyAssessmentStartInputSchema = z.object({
  track: z.enum(["core-technical", "applied-engineering"]),
  pathKey: z.string().trim().min(1).max(80)
});
