import { Request, Response } from "express";

import { chatService } from "../services/ChatService";

interface ChatParams {
  orderId?: string;
}

interface CreateChatMessageBody {
  senderId?: string;
  content?: string;
}

interface SetChatTypingBody {
  senderId?: string;
  isTyping?: boolean;
}

export async function getChatMessagesController(
  request: Request,
  response: Response,
) {
  try {
    const params = request.params as ChatParams;
    const result = await chatService.getChatMessages({
      orderId: params.orderId ?? "",
    });

    response.status(200).json(result);
  } catch (error) {
    console.error("[CHAT_MESSAGES_GET_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to load chat messages.";

    if (message.includes("orderId is required")) {
      response.status(400).json({ message });
      return;
    }

    if (message.includes("was not found")) {
      response.status(404).json({ message });
      return;
    }

    response.status(500).json({ message: "Failed to load chat messages." });
  }
}

export async function createChatMessageController(
  request: Request,
  response: Response,
) {
  try {
    const params = request.params as ChatParams;
    const body = request.body as CreateChatMessageBody;

    const result = await chatService.createChatMessage({
      orderId: params.orderId ?? "",
      senderId: body.senderId ?? "",
      content: body.content ?? "",
    });

    response.status(201).json(result);
  } catch (error) {
    console.error("[CHAT_MESSAGE_CREATE_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to create chat message.";

    if (
      message.includes("orderId is required") ||
      message.includes("senderId is required") ||
      message.includes("content is required")
    ) {
      response.status(400).json({ message });
      return;
    }

    if (message.includes("Only order participants can send messages")) {
      response.status(403).json({ message });
      return;
    }

    if (message.includes("was not found")) {
      response.status(404).json({ message });
      return;
    }

    response.status(500).json({ message: "Failed to create chat message." });
  }
}

export async function getChatTypingController(
  request: Request,
  response: Response,
) {
  try {
    const params = request.params as ChatParams;
    const result = await chatService.getChatTyping({
      orderId: params.orderId ?? "",
    });

    response.status(200).json(result);
  } catch (error) {
    console.error("[CHAT_TYPING_GET_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to load typing state.";

    if (message.includes("orderId is required")) {
      response.status(400).json({ message });
      return;
    }

    if (message.includes("was not found")) {
      response.status(404).json({ message });
      return;
    }

    response.status(500).json({ message: "Failed to load typing state." });
  }
}

export async function setChatTypingController(
  request: Request,
  response: Response,
) {
  try {
    const params = request.params as ChatParams;
    const body = request.body as SetChatTypingBody;

    const result = await chatService.setChatTyping({
      orderId: params.orderId ?? "",
      senderId: body.senderId ?? "",
      isTyping: Boolean(body.isTyping),
    });

    response.status(200).json(result);
  } catch (error) {
    console.error("[CHAT_TYPING_SET_ERROR]", error);

    const message =
      error instanceof Error ? error.message : "Failed to update typing state.";

    if (
      message.includes("orderId is required") ||
      message.includes("senderId is required")
    ) {
      response.status(400).json({ message });
      return;
    }

    if (message.includes("Only order participants can update typing state")) {
      response.status(403).json({ message });
      return;
    }

    if (message.includes("was not found")) {
      response.status(404).json({ message });
      return;
    }

    response.status(500).json({ message: "Failed to update typing state." });
  }
}
