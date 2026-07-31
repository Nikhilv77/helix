import { z } from "zod";

export const architectureDiagramAiOutputSchema = z.object({
  mermaid: z.string().min(1)
});

export const architectureDiagramSchema = z.object({
  type: z.literal("flowchart"),
  direction: z.literal("TD"),
  mermaid: z.string().min(1),
  generatedAt: z.string().datetime()
});

export type ArchitectureDiagramAiOutput = z.infer<typeof architectureDiagramAiOutputSchema>;
export type ArchitectureDiagram = z.infer<typeof architectureDiagramSchema>;

