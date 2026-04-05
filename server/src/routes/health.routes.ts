import { Router } from "express";

import { getHealthController } from "../controllers/health.controller";

export const healthRouter = Router();

healthRouter.get("/", getHealthController);