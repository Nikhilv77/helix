import { Module } from "@nestjs/common";
import { CapacityCalculatorTool } from "./capacity-calculator/capacity-calculator.tool";
import { ToolRegistry } from "./tool-registry";
import { ToolsController } from "./tools.controller";
import { ToolsService } from "./tools.service";

@Module({
  controllers: [ToolsController],
  providers: [CapacityCalculatorTool, ToolRegistry, ToolsService],
  exports: [ToolsService, ToolRegistry]
})
export class ToolsModule {}

