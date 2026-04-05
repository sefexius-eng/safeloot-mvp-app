import { Router } from "express";

import { handleTripleAWebhookController } from "../controllers/triplea-webhook.controller";

export const webhooksRouter = Router();

webhooksRouter.post("/triplea", handleTripleAWebhookController);