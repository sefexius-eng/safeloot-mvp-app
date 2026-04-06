"use server";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export interface NotificationListItem {
  id: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

async function requireNotificationUserId() {
  const session = await getAuthSession();
  const userId = session?.user?.id?.trim();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

export async function getUnreadNotifications(): Promise<NotificationListItem[]> {
  const userId = await requireNotificationUserId();

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return notifications.map((notification) => ({
    ...notification,
    createdAt: notification.createdAt.toISOString(),
  }));
}

export async function markNotificationAsRead(id: string) {
  const userId = await requireNotificationUserId();
  const notificationId = id.trim();

  if (!notificationId) {
    throw new Error("Notification id is required.");
  }

  const updatedNotification = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  if (updatedNotification.count !== 1) {
    throw new Error("Уведомление не найдено или уже прочитано.");
  }

  return {
    ok: true,
  };
}