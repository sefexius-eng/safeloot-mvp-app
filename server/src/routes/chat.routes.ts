import { Router } from "express";

import {
	createChatMessageController,
	getChatTypingController,
	getChatMessagesController,
	setChatTypingController,
} from "../controllers/chat.controller";

export const chatRouter = Router();

chatRouter.get("/:orderId/typing", getChatTypingController);
chatRouter.post("/:orderId/typing", setChatTypingController);
chatRouter.get("/:orderId", getChatMessagesController);
chatRouter.post("/:orderId", createChatMessageController);

