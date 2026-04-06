"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  BANNED_USER_MESSAGE,
  getCurrentSessionUser,
  hasActiveAdminAccess,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  completeOrder,
  confirmOrder as confirmPendingPayment,
  createOrder,
  openOrderDispute,
  refundOrder as refundOrderBySeller,
  resolveOrderDisputeToBuyer,
  resolveOrderDisputeToSeller,
} from "@/lib/marketplace";

interface OrderActionResult {
  ok: boolean;
  message?: string;
  status?: string;
  platformFee?: string;
  refundAmount?: string;
  sellerNetAmount?: string;
}

interface CreatePendingOrderResult {
  ok: boolean;
  orderId?: string;
  message?: string;
}

export interface ProcessPaymentState {
  message?: string;
}

async function requireActiveOrderUser() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (currentUser.isBanned) {
    throw new Error(BANNED_USER_MESSAGE);
  }

  return currentUser;
}

async function requireAdminOrderUser() {
  const currentUser = await requireActiveOrderUser();

  if (!hasActiveAdminAccess(currentUser)) {
    throw new Error("Недостаточно прав для арбитражного решения.");
  }

  return currentUser;
}

function revalidateOrderPaths(orderId: string) {
  revalidatePath(`/order/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/profile");
}

export async function createPendingOrder(
  productId: string,
): Promise<CreatePendingOrderResult> {
  try {
    const currentUser = await requireActiveOrderUser();
    const result = await createOrder({
      productId,
      buyerId: currentUser.id,
    });

    return {
      ok: true,
      orderId: result.orderId,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось создать заказ.",
    };
  }
}

export async function processPayment(
  orderId: string,
  _previousState: ProcessPaymentState,
  _formData: FormData,
): Promise<ProcessPaymentState> {
  let result:
    | {
        orderId: string;
        status: string;
      }
    | null = null;

  try {
    const currentUser = await requireActiveOrderUser();

    result = await confirmPendingPayment({
      orderId,
      buyerId: currentUser.id,
    });
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Не удалось подтвердить оплату.",
    };
  }

  revalidateOrderPaths(result.orderId);
  redirect(`/orders/${result.orderId}`);
}

export async function openDispute(orderId: string): Promise<OrderActionResult> {
  try {
    const currentUser = await requireActiveOrderUser();
    const result = await openOrderDispute({
      orderId,
      userId: currentUser.id,
    });

    revalidateOrderPaths(result.orderId);

    return {
      ok: true,
      status: result.status,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не удалось открыть спор.",
    };
  }
}

export async function confirmOrder(orderId: string): Promise<OrderActionResult> {
  try {
    const currentUser = await requireActiveOrderUser();
    const result = await completeOrder({
      orderId,
      buyerId: currentUser.id,
    });

    revalidateOrderPaths(result.orderId);

    return {
      ok: true,
      status: result.status,
      platformFee: result.platformFee,
      sellerNetAmount: result.sellerNetAmount,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось подтвердить получение товара.",
    };
  }
}

export async function refundOrder(orderId: string): Promise<OrderActionResult> {
  try {
    const currentUser = await requireActiveOrderUser();
    const result = await refundOrderBySeller({
      orderId,
      sellerId: currentUser.id,
    });

    revalidateOrderPaths(result.orderId);

    return {
      ok: true,
      status: result.status,
      refundAmount: result.refundAmount,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось оформить возврат.",
    };
  }
}

export async function resolveDisputeToBuyer(
  orderId: string,
): Promise<OrderActionResult> {
  try {
    await requireAdminOrderUser();
    const result = await resolveOrderDisputeToBuyer({ orderId });

    revalidateOrderPaths(result.orderId);

    return {
      ok: true,
      status: result.status,
      refundAmount: result.refundAmount,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось вернуть деньги покупателю.",
    };
  }
}

export async function resolveDisputeToSeller(
  orderId: string,
): Promise<OrderActionResult> {
  try {
    await requireAdminOrderUser();
    const result = await resolveOrderDisputeToSeller({ orderId });

    revalidateOrderPaths(result.orderId);

    return {
      ok: true,
      status: result.status,
      platformFee: result.platformFee,
      sellerNetAmount: result.sellerNetAmount,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось передать средства продавцу.",
    };
  }
}