import { ZodType } from "zod";

export interface InternalTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodType<unknown>;
  readonly outputSchema: ZodType<unknown>;
  execute(input: unknown): unknown;
}
