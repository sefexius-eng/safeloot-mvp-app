import { HealthCheckResponse } from "../models/health.model";
import { pingDatabase } from "./database.service";

export async function getHealthStatus(): Promise<HealthCheckResponse> {
  const database = await pingDatabase();

  return {
    status: database === "up" ? "ok" : "degraded",
    service: "server",
    timestamp: new Date().toISOString(),
    database,
  };
}