import { AppConfigService } from "../config/app-config.service";
import { PrismaService } from "../database/prisma.service";
import { HealthResponse } from "./health.types";

export class HealthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const databaseIsHealthy = await this.isDatabaseHealthy();

    return {
      status: databaseIsHealthy ? "ok" : "unhealthy",
      database: {
        status: databaseIsHealthy ? "up" : "down"
      },
      appName: this.config.appName,
      appVersion: this.config.appVersion,
      environment: this.config.nodeEnv,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  private async isDatabaseHealthy(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
