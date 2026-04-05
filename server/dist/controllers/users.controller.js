"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUserController = getCurrentUserController;
exports.getCurrentUserProductsController = getCurrentUserProductsController;
const UserService_1 = require("../services/UserService");
function getUserIdFromHeader(request) {
    return request.header("x-user-id")?.trim() ?? "";
}
async function getCurrentUserController(request, response) {
    try {
        const result = await UserService_1.userService.getUserById(getUserIdFromHeader(request));
        response.status(200).json(result);
    }
    catch (error) {
        console.error("[USER_ME_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to load current user.";
        if (message.includes("userId is required")) {
            response.status(400).json({ message });
            return;
        }
        if (message.includes("was not found")) {
            response.status(404).json({ message });
            return;
        }
        response.status(500).json({ message: "Failed to load current user." });
    }
}
async function getCurrentUserProductsController(request, response) {
    try {
        const result = await UserService_1.userService.listUserProducts(getUserIdFromHeader(request));
        response.status(200).json(result);
    }
    catch (error) {
        console.error("[USER_ME_PRODUCTS_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to load current user products.";
        if (message.includes("sellerId is required") || message.includes("userId is required")) {
            response.status(400).json({ message });
            return;
        }
        response.status(500).json({ message: "Failed to load current user products." });
    }
}
