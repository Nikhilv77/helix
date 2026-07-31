export type DependencyStatus = "up" | "down";
export type ApplicationStatus = "ok" | "unhealthy";

export interface HealthResponse {
  status: ApplicationStatus;
  database: {
    status: DependencyStatus;
  };
  appName: string;
  appVersion: string;
  environment: string;
  uptime: number;
  timestamp: string;
}
