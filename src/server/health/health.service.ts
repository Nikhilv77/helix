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
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      console.error("[HealthService] database check failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
        message: details
          .replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL]")
          .replace(/(?:DATABASE_URL|DIRECT_URL)=\S+/g, "[database URL]")
          .slice(0, 1200)
      });
      return false;
    }
  }
}
