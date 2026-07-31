import { Injectable } from "@nestjs/common";
import {
  CAPACITY_CALCULATOR_TOOL_NAME,
  CapacityCalculatorOutput
} from "./capacity-calculator/capacity-calculator.schema";
import { ToolRegistry } from "./tool-registry";

@Injectable()
export class ToolsService {
  constructor(private readonly toolRegistry: ToolRegistry) {}

  calculateCapacity(input: unknown): Promise<CapacityCalculatorOutput> {
    return this.toolRegistry.execute<CapacityCalculatorOutput>(CAPACITY_CALCULATOR_TOOL_NAME, input);
  }
}

