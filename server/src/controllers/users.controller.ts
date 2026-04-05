import { Request, Response } from "express";

import { userService } from "../services/UserService";

function getUserIdFromHeader(request: Request) {
  return request.header("x-user-id")?.trim() ?? "";
}

export async function getCurrentUserController(
  request: Request,
  response: Response,
) {
  try {
    const result = await userService.getUserById(getUserIdFromHeader(request));

    response.status(200).json(result);
  } catch (error) {
    console.error("[USER_ME_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to load current user.";

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

export async function getCurrentUserProductsController(
  request: Request,
  response: Response,
) {
  try {
    const result = await userService.listUserProducts(getUserIdFromHeader(request));

    response.status(200).json(result);
  } catch (error) {
    console.error("[USER_ME_PRODUCTS_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to load current user products.";

    if (message.includes("sellerId is required") || message.includes("userId is required")) {
      response.status(400).json({ message });
      return;
    }

    response.status(500).json({ message: "Failed to load current user products." });
  }
}
