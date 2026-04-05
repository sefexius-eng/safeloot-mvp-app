"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealthStatus = getHealthStatus;
const database_service_1 = require("./database.service");
async function getHealthStatus() {
    const database = await (0, database_service_1.pingDatabase)();
    return {
        status: database === "up" ? "ok" : "degraded",
        service: "server",
        timestamp: new Date().toISOString(),
        database,
    };
}
