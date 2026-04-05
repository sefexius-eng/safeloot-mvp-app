"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const users_controller_1 = require("../controllers/users.controller");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.get("/me", users_controller_1.getCurrentUserController);
exports.usersRouter.get("/me/products", users_controller_1.getCurrentUserProductsController);
