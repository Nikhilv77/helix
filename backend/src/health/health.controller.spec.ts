import { HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { HealthResponse } from "./health.types";

describe("HealthController", () => {
  const healthyResponse: HealthResponse = {
    status: "ok",
    database: {
      status: "up"
    },
    appName: "AI System Design Copilot",
    appVersion: "0.1.0",
    environment: "test",
    uptime: 1,
    timestamp: "2026-01-01T00:00:00.000Z"
  };

  it("returns health data from the service", async () => {
    const getHealth = jest.fn().mockResolvedValue(healthyResponse);
    const status = jest.fn();
    const service = {
      getHealth
    } as unknown as HealthService;
    const controller = new HealthController(service);
    const response = { status } as unknown as Response;

    await expect(controller.getHealth(response)).resolves.toBe(healthyResponse);
    expect(status).not.toHaveBeenCalled();
  });

  it("sets 503 for unhealthy results", async () => {
    const unhealthyResponse: HealthResponse = {
      ...healthyResponse,
      status: "unhealthy",
      database: {
        status: "down"
      }
    };
    const getHealth = jest.fn().mockResolvedValue(unhealthyResponse);
    const status = jest.fn();
    const service = {
      getHealth
    } as unknown as HealthService;
    const controller = new HealthController(service);
    const response = { status } as unknown as Response;

    await expect(controller.getHealth(response)).resolves.toBe(unhealthyResponse);
    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
