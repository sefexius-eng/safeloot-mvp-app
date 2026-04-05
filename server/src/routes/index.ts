import { Router } from "express";

import { chatRouter } from "./chat.routes";
import { healthRouter } from "./health.routes";
import { ordersRouter } from "./orders.routes";
import { productsRouter } from "./products.routes";
import { usersRouter } from "./users.routes";
import { webhooksRouter } from "./webhooks.routes";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/webhooks", webhooksRouter);

