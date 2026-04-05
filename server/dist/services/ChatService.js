"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const prisma_service_1 = require("./prisma.service");
const TYPING_TTL_MS = 5000;
const chatTypingState = new Map();
class ChatService {
    prismaClient;
    constructor(prismaClient = prisma_service_1.prisma) {
        this.prismaClient = prismaClient;
    }
    async getChatMessages(input) {
        const orderId = input.orderId.trim();
        if (!orderId) {
            throw new Error("orderId is required.");
        }
        const chatRoom = await this.prismaClient.chatRoom.findUnique({
            where: {
                orderId,
            },
            select: {
                id: true,
                orderId: true,
                messages: {
                    orderBy: {
                        createdAt: "asc",
                    },
                    select: {
                        id: true,
                        content: true,
                        senderId: true,
                        createdAt: true,
                        updatedAt: true,
                        sender: {
                            select: {
                                id: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });
        if (!chatRoom) {
            throw new Error(`Chat for order ${orderId} was not found.`);
        }
        return {
            orderId: chatRoom.orderId,
            chatRoomId: chatRoom.id,
            messages: chatRoom.messages,
        };
    }
    async createChatMessage(input) {
        const orderId = input.orderId.trim();
        const senderId = input.senderId.trim();
        const content = input.content.trim();
        if (!orderId) {
            throw new Error("orderId is required.");
        }
        if (!senderId) {
            throw new Error("senderId is required.");
        }
        if (!content) {
            throw new Error("content is required.");
        }
        const chatRoom = await this.prismaClient.chatRoom.findUnique({
            where: {
                orderId,
            },
            select: {
                id: true,
                orderId: true,
                buyerId: true,
                sellerId: true,
            },
        });
        if (!chatRoom) {
            throw new Error(`Chat for order ${orderId} was not found.`);
        }
        if (senderId !== chatRoom.buyerId && senderId !== chatRoom.sellerId) {
            throw new Error("Only order participants can send messages.");
        }
        this.setTypingState(orderId, senderId, false);
        const message = await this.prismaClient.message.create({
            data: {
                chatRoomId: chatRoom.id,
                senderId,
                content,
            },
            select: {
                id: true,
                content: true,
                senderId: true,
                createdAt: true,
                updatedAt: true,
                sender: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        });
        return {
            orderId: chatRoom.orderId,
            chatRoomId: chatRoom.id,
            message,
        };
    }
    async getChatTyping(input) {
        const orderId = input.orderId.trim();
        if (!orderId) {
            throw new Error("orderId is required.");
        }
        const chatRoom = await this.prismaClient.chatRoom.findUnique({
            where: {
                orderId,
            },
            select: {
                orderId: true,
                buyerId: true,
                sellerId: true,
                buyer: {
                    select: {
                        email: true,
                    },
                },
                seller: {
                    select: {
                        email: true,
                    },
                },
            },
        });
        if (!chatRoom) {
            throw new Error(`Chat for order ${orderId} was not found.`);
        }
        return {
            orderId: chatRoom.orderId,
            typingUsers: this.getTypingUsers(chatRoom),
        };
    }
    async setChatTyping(input) {
        const orderId = input.orderId.trim();
        const senderId = input.senderId.trim();
        if (!orderId) {
            throw new Error("orderId is required.");
        }
        if (!senderId) {
            throw new Error("senderId is required.");
        }
        const chatRoom = await this.prismaClient.chatRoom.findUnique({
            where: {
                orderId,
            },
            select: {
                orderId: true,
                buyerId: true,
                sellerId: true,
                buyer: {
                    select: {
                        email: true,
                    },
                },
                seller: {
                    select: {
                        email: true,
                    },
                },
            },
        });
        if (!chatRoom) {
            throw new Error(`Chat for order ${orderId} was not found.`);
        }
        if (senderId !== chatRoom.buyerId && senderId !== chatRoom.sellerId) {
            throw new Error("Only order participants can update typing state.");
        }
        this.setTypingState(orderId, senderId, input.isTyping);
        return {
            orderId: chatRoom.orderId,
            typingUsers: this.getTypingUsers(chatRoom),
        };
    }
    setTypingState(orderId, senderId, isTyping) {
        const currentOrderTyping = chatTypingState.get(orderId) ?? new Map();
        if (isTyping) {
            currentOrderTyping.set(senderId, Date.now());
            chatTypingState.set(orderId, currentOrderTyping);
            return;
        }
        currentOrderTyping.delete(senderId);
        if (currentOrderTyping.size === 0) {
            chatTypingState.delete(orderId);
            return;
        }
        chatTypingState.set(orderId, currentOrderTyping);
    }
    getTypingUsers(chatRoom) {
        const now = Date.now();
        const currentOrderTyping = chatTypingState.get(chatRoom.orderId) ?? new Map();
        for (const [senderId, lastTypedAt] of currentOrderTyping.entries()) {
            if (now - lastTypedAt > TYPING_TTL_MS) {
                currentOrderTyping.delete(senderId);
            }
        }
        if (currentOrderTyping.size === 0) {
            chatTypingState.delete(chatRoom.orderId);
            return [];
        }
        chatTypingState.set(chatRoom.orderId, currentOrderTyping);
        const typingUsers = [];
        if (currentOrderTyping.has(chatRoom.buyerId)) {
            typingUsers.push({
                senderId: chatRoom.buyerId,
                role: "BUYER",
                email: chatRoom.buyer.email,
            });
        }
        if (currentOrderTyping.has(chatRoom.sellerId)) {
            typingUsers.push({
                senderId: chatRoom.sellerId,
                role: "SELLER",
                email: chatRoom.seller.email,
            });
        }
        return typingUsers;
    }
}
exports.ChatService = ChatService;
exports.chatService = new ChatService();
