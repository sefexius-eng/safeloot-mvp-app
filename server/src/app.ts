import cors from "cors";
import express from "express";

import { apiRouter } from "./routes";

export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

  app.use(cors({ origin: corsOrigin }));
  app.use(
    express.json({
      verify: (request, _response, buffer) => {
        (request as express.Request & { rawBody?: string }).rawBody =
          buffer.toString("utf8");
      },
    }),
  );

  app.get("/", (_request, response) => {
    response.json({
      message: "Fullstack starter server is ready.",
      api: "/api/health",
    });
  });

  app.use("/api", apiRouter);

  return app;
}