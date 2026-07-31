import { Body, Controller, Post } from "@nestjs/common";
import { CapacityCalculatorOutput } from "./capacity-calculator/capacity-calculator.schema";
import { ToolsService } from "./tools.service";

@Controller({
  path: "tools",
  version: "1"
})
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post("capacity-calculator")
  calculateCapacity(@Body() body: unknown): Promise<CapacityCalculatorOutput> {
    return this.toolsService.calculateCapacity(body);
  }
}

