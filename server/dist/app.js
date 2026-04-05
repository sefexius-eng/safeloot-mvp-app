"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const routes_1 = require("./routes");
function createApp() {
    const app = (0, express_1.default)();
    const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
    app.use((0, cors_1.default)({ origin: corsOrigin }));
    app.use(express_1.default.json({
        verify: (request, _response, buffer) => {
            request.rawBody =
                buffer.toString("utf8");
        },
    }));
    app.get("/", (_request, response) => {
        response.json({
            message: "Fullstack starter server is ready.",
            api: "/api/health",
        });
    });
    app.use("/api", routes_1.apiRouter);
    return app;
}
