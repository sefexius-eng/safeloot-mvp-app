import { Router } from "express";

import {
	completeOrderController,
	confirmOrderController,
	createOrderController,
	getOrderController,
} from "../controllers/orders.controller";

export const ordersRouter = Router();

ordersRouter.post("/confirm", confirmOrderController);
ordersRouter.post("/:orderId/complete", completeOrderController);
ordersRouter.get("/:orderId", getOrderController);
ordersRouter.post("/", createOrderController);
