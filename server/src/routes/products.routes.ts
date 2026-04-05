import { Router } from "express";

import {
	createProductController,
	getProductByIdController,
	getProductsController,
} from "../controllers/products.controller";

export const productsRouter = Router();

productsRouter.get("/", getProductsController);
productsRouter.get("/:id", getProductByIdController);
productsRouter.post("/", createProductController);