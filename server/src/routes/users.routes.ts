import { Router } from "express";

import {
	getCurrentUserController,
	getCurrentUserProductsController,
} from "../controllers/users.controller";

export const usersRouter = Router();

usersRouter.get("/me", getCurrentUserController);
usersRouter.get("/me/products", getCurrentUserProductsController);
