import type { ZodType } from "zod";

export type AiModelClass = "fast" | "reasoning";

export interface GenerateStructuredRequest<T> {
  operation: string;
  systemInstruction: string;
  prompt: string;
  schema: ZodType<T>;
  modelClass: AiModelClass;
  temperature?: number;
}

export interface SystemDesignerAIProvider {
  generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<T>;
}
