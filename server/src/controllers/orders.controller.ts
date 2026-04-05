import { Request, Response } from "express";

import { orderService } from "../services/OrderService";

interface CreateOrderBody {
  productId?: string;
  buyerId?: string;
}

interface GetOrderParams {
  orderId?: string;
}

interface ConfirmOrderBody {
  orderId?: string;
}

interface CompleteOrderParams {
  orderId?: string;
}

export async function createOrderController(
  request: Request,
  response: Response,
) {
  try {
    const body = request.body as CreateOrderBody;
    const result = await orderService.createOrder({
      productId: body.productId ?? "",
      buyerId: body.buyerId ?? "",
    });

    response.status(201).json(result);
  } catch (error) {
    console.error("[ORDER_CREATE_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to create order.";

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

export async function getOrderController(
  request: Request,
  response: Response,
) {
  try {
    const params = request.params as GetOrderParams;
    const result = await orderService.getOrder({
      orderId: params.orderId ?? "",
    });

    response.status(200).json(result);
  } catch (error) {
    console.error("[ORDER_GET_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to load order.";

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

export async function confirmOrderController(
  request: Request,
  response: Response,
) {
  try {
    const body = request.body as ConfirmOrderBody;
    const result = await orderService.confirmOrder({
      orderId: body.orderId ?? "",
      buyerId: request.header("x-user-id")?.trim() ?? "",
    });

    response.status(200).json(result);
  } catch (error) {
    console.error("[ORDER_CONFIRM_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to confirm order.";

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

export async function completeOrderController(
  request: Request,
  response: Response,
) {
  try {
    const params = request.params as CompleteOrderParams;
    const result = await orderService.completeOrder({
      orderId: params.orderId ?? "",
      buyerId: request.header("x-user-id")?.trim() ?? "",
    });

    response.status(200).json(result);
  } catch (error) {
    console.error("[ORDER_COMPLETE_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to complete order.";

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