import { Controller, Get, HttpCode, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { HealthService } from "./health.service";
import type { HealthResponse } from "./health.types";

@Controller({
  path: "health",
  version: "1"
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const health = await this.healthService.getHealth();

    if (health.status === "unhealthy") {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}
