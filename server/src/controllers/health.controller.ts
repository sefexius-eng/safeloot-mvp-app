import { Request, Response } from "express";

import { getHealthStatus } from "../services/health.service";

export async function getHealthController(
  _request: Request,
  response: Response,
) {
  const health = await getHealthStatus();

  response.status(health.database === "up" ? 200 : 503).json(health);
}