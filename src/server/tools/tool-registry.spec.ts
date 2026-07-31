import { z } from "zod";
import { HTTP_STATUS } from "../common/http-error";
import { CapacityCalculatorTool } from "./capacity-calculator/capacity-calculator.tool";
import { InternalTool } from "./interfaces/internal-tool.interface";
import { ToolExecutionException } from "./tool-execution.exception";
import { ToolRegistry } from "./tool-registry";

describe("ToolRegistry", () => {
  it("executes a registered tool with validated input and output", async () => {
    const registry = new ToolRegistry(new CapacityCalculatorTool());

    await expect(
      registry.execute("capacity-calculator", {
        monthlyActiveUsers: 10_000
      })
    ).resolves.toMatchObject({
      toolName: "capacity-calculator",
      inputs: {
        monthlyActiveUsers: 10_000,
        dailyActiveUserPercentage: 20
      }
    });
  });

  it("returns structured validation errors for invalid input", async () => {
    const registry = new ToolRegistry(new CapacityCalculatorTool());

    await expect(
      registry.execute("capacity-calculator", {
        monthlyActiveUsers: -1
      })
    ).rejects.toMatchObject({
      code: "TOOL_INPUT_INVALID",
      message: "Tool input validation failed"
    });
  });

  it("maps invalid tool output to a structured internal error", async () => {
    const registry = new TestToolRegistry({
      name: "broken-tool",
      description: "Broken test tool",
      inputSchema: z.object({ ok: z.boolean() }),
      outputSchema: z.object({ expected: z.string() }),
      execute: () => ({ unexpected: true })
    });

    await expect(registry.execute("broken-tool", { ok: true })).rejects.toMatchObject({
      code: "TOOL_OUTPUT_INVALID",
      message: "Tool produced invalid output",
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
    });
  });

  it("rejects unknown tools", async () => {
    const registry = new ToolRegistry(new CapacityCalculatorTool());

    await expect(registry.execute("missing-tool", {})).rejects.toBeInstanceOf(
      ToolExecutionException
    );
  });
});

class TestToolRegistry extends ToolRegistry {
  constructor(tool: InternalTool) {
    super(new CapacityCalculatorTool());
    Object.defineProperty(this, "tools", {
      value: new Map([[tool.name, tool]])
    });
  }
}
