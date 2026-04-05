"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatMessagesController = getChatMessagesController;
exports.createChatMessageController = createChatMessageController;
exports.getChatTypingController = getChatTypingController;
exports.setChatTypingController = setChatTypingController;
const ChatService_1 = require("../services/ChatService");
async function getChatMessagesController(request, response) {
    try {
        const params = request.params;
        const result = await ChatService_1.chatService.getChatMessages({
            orderId: params.orderId ?? "",
        });
        response.status(200).json(result);
    }
    catch (error) {
        console.error("[CHAT_MESSAGES_GET_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to load chat messages.";
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
async function createChatMessageController(request, response) {
    try {
        const params = request.params;
        const body = request.body;
        const result = await ChatService_1.chatService.createChatMessage({
            orderId: params.orderId ?? "",
            senderId: body.senderId ?? "",
            content: body.content ?? "",
        });
        response.status(201).json(result);
    }
    catch (error) {
        console.error("[CHAT_MESSAGE_CREATE_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to create chat message.";
        if (message.includes("orderId is required") ||
            message.includes("senderId is required") ||
            message.includes("content is required")) {
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
async function getChatTypingController(request, response) {
    try {
        const params = request.params;
        const result = await ChatService_1.chatService.getChatTyping({
            orderId: params.orderId ?? "",
        });
        response.status(200).json(result);
    }
    catch (error) {
        console.error("[CHAT_TYPING_GET_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to load typing state.";
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
async function setChatTypingController(request, response) {
    try {
        const params = request.params;
        const body = request.body;
        const result = await ChatService_1.chatService.setChatTyping({
            orderId: params.orderId ?? "",
            senderId: body.senderId ?? "",
            isTyping: Boolean(body.isTyping),
        });
        response.status(200).json(result);
    }
    catch (error) {
        console.error("[CHAT_TYPING_SET_ERROR]", error);
        const message = error instanceof Error ? error.message : "Failed to update typing state.";
        if (message.includes("orderId is required") ||
            message.includes("senderId is required")) {
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
