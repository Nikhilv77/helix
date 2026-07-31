import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ZodError } from "zod";
import { CapacityCalculatorTool } from "./capacity-calculator/capacity-calculator.tool";
import { InternalTool } from "./interfaces/internal-tool.interface";
import { ToolExecutionException } from "./tool-execution.exception";

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools: ReadonlyMap<string, InternalTool>;

  constructor(capacityCalculatorTool: CapacityCalculatorTool) {
    this.tools = new Map([[capacityCalculatorTool.name, capacityCalculatorTool]]);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }

  async execute<TOutput>(toolName: string, input: unknown): Promise<TOutput> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new ToolExecutionException("TOOL_NOT_FOUND", "Tool not found", { toolName });
    }

    const parsedInput = this.parseInput(tool, input);

    try {
      this.logger.log({
        event: "tool_execution_started",
        toolName
      });
      const output = await tool.execute(parsedInput);
      const parsedOutput = tool.outputSchema.safeParse(output);

      if (!parsedOutput.success) {
        throw new ToolExecutionException(
          "TOOL_OUTPUT_INVALID",
          "Tool produced invalid output",
          {
            toolName,
            issues: this.formatZodIssues(parsedOutput.error)
          },
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      this.logger.log({
        event: "tool_execution_completed",
        toolName
      });

      return parsedOutput.data as TOutput;
    } catch (error: unknown) {
      if (error instanceof ToolExecutionException) {
        throw error;
      }

      throw new ToolExecutionException(
        "TOOL_EXECUTION_FAILED",
        "Tool execution failed",
        { toolName },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private parseInput(tool: InternalTool, input: unknown): unknown {
    const parsedInput = tool.inputSchema.safeParse(input);

    if (!parsedInput.success) {
      throw new ToolExecutionException("TOOL_INPUT_INVALID", "Tool input validation failed", {
        toolName: tool.name,
        issues: this.formatZodIssues(parsedInput.error)
      });
    }

    return parsedInput.data;
  }

  private formatZodIssues(error: ZodError): Record<string, unknown>[] {
    return error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));
  }
}

