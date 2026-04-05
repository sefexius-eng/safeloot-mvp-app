export type DatabaseStatus = "up" | "down";
export type ServiceStatus = "ok" | "degraded";

export interface HealthCheckResponse {
  status: ServiceStatus;
  service: "server";
  timestamp: string;
  database: DatabaseStatus;
}