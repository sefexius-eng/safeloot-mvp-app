"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhooksRouter = void 0;
const express_1 = require("express");
const triplea_webhook_controller_1 = require("../controllers/triplea-webhook.controller");
exports.webhooksRouter = (0, express_1.Router)();
exports.webhooksRouter.post("/triplea", triplea_webhook_controller_1.handleTripleAWebhookController);
