import { PrismaClient } from "@prisma/client";

import { prisma } from "./prisma.service";

const TYPING_TTL_MS = 5000;
const chatTypingState = new Map<string, Map<string, number>>();

export interface GetChatMessagesInput {
  orderId: string;
}

export interface CreateChatMessageInput {
  orderId: string;
  senderId: string;
  content: string;
}

export interface GetChatTypingInput {
  orderId: string;
}

export interface SetChatTypingInput {
  orderId: string;
  senderId: string;
  isTyping: boolean;
}

export interface ChatMessageDto {
  id: string;
  content: string;
  senderId: string;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    email: string;
  };
}

export interface GetChatMessagesResult {
  orderId: string;
  chatRoomId: string;
  messages: ChatMessageDto[];
}

export interface CreateChatMessageResult {
  orderId: string;
  chatRoomId: string;
  message: ChatMessageDto;
}

export interface ChatTypingUserDto {
  senderId: string;
  role: "BUYER" | "SELLER";
  email: string;
}

export interface GetChatTypingResult {
  orderId: string;
  typingUsers: ChatTypingUserDto[];
}

export interface SetChatTypingResult {
  orderId: string;
  typingUsers: ChatTypingUserDto[];
}

export class ChatService {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async getChatMessages(
    input: GetChatMessagesInput,
  ): Promise<GetChatMessagesResult> {
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

  async createChatMessage(
    input: CreateChatMessageInput,
  ): Promise<CreateChatMessageResult> {
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

  async getChatTyping(
    input: GetChatTypingInput,
  ): Promise<GetChatTypingResult> {
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

  async setChatTyping(
    input: SetChatTypingInput,
  ): Promise<SetChatTypingResult> {
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

  private setTypingState(orderId: string, senderId: string, isTyping: boolean) {
    const currentOrderTyping = chatTypingState.get(orderId) ?? new Map<string, number>();

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

  private getTypingUsers(chatRoom: {
    orderId: string;
    buyerId: string;
    sellerId: string;
    buyer: { email: string };
    seller: { email: string };
  }) {
    const now = Date.now();
    const currentOrderTyping = chatTypingState.get(chatRoom.orderId) ?? new Map<string, number>();

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

    const typingUsers: ChatTypingUserDto[] = [];

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

export const chatService = new ChatService();
