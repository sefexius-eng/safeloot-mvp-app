"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealthController = getHealthController;
const health_service_1 = require("../services/health.service");
async function getHealthController(_request, response) {
    const health = await (0, health_service_1.getHealthStatus)();
    response.status(health.database === "up" ? 200 : 503).json(health);
}
