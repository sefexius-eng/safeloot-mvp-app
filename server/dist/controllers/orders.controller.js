"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrderController = createOrderController;
exports.getOrderController = getOrderController;
exports.confirmOrderController = confirmOrderController;
exports.completeOrderController = completeOrderController;
const OrderService_1 = require("../services/OrderService");
async function createOrderController(request, response) {
    try {
        const body = request.body;
        const result = await OrderService_1.orderService.createOrder({
            productId: body.productId ?? "",
            buyerId: body.buyerId ?? "",
        });
        response.status(201).json(result);
    }
    catch (error) {
        console.error("[ORDER_CREATE_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to create order.";
        if (message.includes("productId is required") || message.includes("buyerId is required")) {
            response.status(400).json({ message });
            return;
        }
        if (message.includes("was not found")) {
            response.status(404).json({ message });
            return;
        }
        response.status(500).json({ message: "Failed to create order." });
    }
}
async function getOrderController(request, response) {
    try {
        const params = request.params;
        const result = await OrderService_1.orderService.getOrder({
            orderId: params.orderId ?? "",
        });
        response.status(200).json(result);
    }
    catch (error) {
        console.error("[ORDER_GET_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to load order.";
        if (message.includes("orderId is required")) {
            response.status(400).json({ message });
            return;
        }
        if (message.includes("was not found")) {
            response.status(404).json({ message });
            return;
        }
        response.status(500).json({ message: "Failed to load order." });
    }
}
async function confirmOrderController(request, response) {
    try {
        const body = request.body;
        const result = await OrderService_1.orderService.confirmOrder({
            orderId: body.orderId ?? "",
            buyerId: request.header("x-user-id")?.trim() ?? "",
        });
        response.status(200).json(result);
    }
    catch (error) {
        console.error("[ORDER_CONFIRM_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to confirm order.";
        if (message.includes("orderId is required") || message.includes("buyerId is required")) {
            response.status(400).json({ message });
            return;
        }
        if (message.includes("Only the buyer can confirm this order")) {
            response.status(403).json({ message });
            return;
        }
        if (message.includes("was not found")) {
            response.status(404).json({ message });
            return;
        }
        if (message.includes("cannot be confirmed")) {
            response.status(409).json({ message });
            return;
        }
        response.status(500).json({ message: "Failed to confirm order." });
    }
}
async function completeOrderController(request, response) {
    try {
        const params = request.params;
        const result = await OrderService_1.orderService.completeOrder({
            orderId: params.orderId ?? "",
            buyerId: request.header("x-user-id")?.trim() ?? "",
        });
        response.status(200).json(result);
    }
    catch (error) {
        console.error("[ORDER_COMPLETE_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to complete order.";
        if (message.includes("orderId is required") || message.includes("buyerId is required")) {
            response.status(400).json({ message });
            return;
        }
        if (message.includes("Only the buyer can complete this order")) {
            response.status(403).json({ message });
            return;
        }
        if (message.includes("was not found")) {
            response.status(404).json({ message });
            return;
        }
        if (message.includes("cannot be completed") || message.includes("could not be completed")) {
            response.status(409).json({ message });
            return;
        }
        response.status(500).json({ message: "Failed to complete order." });
    }
}
