import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BuyProductDialog } from "@/components/product/buy-product-dialog";
import { ConversationRoomView } from "@/components/chat/conversation-room-view";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { getConversationRoom } from "@/lib/marketplace";

interface ChatPageProps {
  params: Promise<{
    id: string;
  }>;
}

function getOrderStatusMeta(status: string) {
  switch (status) {
    case "PENDING":
      return {
        label: "Ожидает оплаты",
        className: "border-amber-500/20 bg-amber-500/10 text-amber-200",
      };
    case "PAID":
      return {
        label: "Escrow активен",
        className: "border-sky-500/20 bg-sky-500/10 text-sky-200",
      };
    case "DELIVERED":
      return {
        label: "Передан продавцом",
        className: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
      };
    case "COMPLETED":
      return {
        label: "Сделка завершена",
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
      };
    case "DISPUTED":
      return {
        label: "Спор открыт",
        className: "border-red-500/20 bg-red-500/10 text-red-200",
      };
    case "REFUNDED":
      return {
        label: "Возврат покупателю",
        className: "border-yellow-500/20 bg-yellow-500/10 text-yellow-200",
      };
    case "CANCELLED":
      return {
        label: "Отменен",
        className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
      };
    default:
      return {
        label: status,
        className: "border-white/10 bg-white/5 text-zinc-200",
      };
  }
}

export default async function ChatRoomPage({ params }: ChatPageProps) {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.isBanned) {
    redirect("/");
  }

  const { id } = await params;

  let conversation;

  try {
    conversation = await getConversationRoom(id, currentUser.id);
  } catch {
    notFound();
  }

  const statusMeta = conversation.latestOrder
    ? getOrderStatusMeta(conversation.latestOrder.status)
    : null;
  const canBuyProduct =
    conversation.product &&
    !conversation.latestOrder &&
    currentUser.id === conversation.buyerId;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_34%),rgba(9,9,11,0.92)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Direct Conversation
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {conversation.product?.title ?? "Личный диалог"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
              Собеседник: {conversation.otherParty.email}. Вы можете обсудить детали товара до покупки или сопровождать уже активную escrow-сделку.
            </p>
          </div>

          <div className="w-full max-w-md rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
            <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
              Статус по товару
            </p>
            {conversation.product ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-lg font-semibold text-white">
                    {conversation.product.title}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Цена: {conversation.product.price} USDT
                  </p>
                </div>

                {statusMeta && conversation.latestOrder ? (
                  <div className="space-y-3">
                    <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                    <div>
                      <Link
                        href={`/orders/${conversation.latestOrder.id}`}
                        className="text-sm font-semibold text-sky-200 transition hover:text-sky-100 hover:underline"
                      >
                        Открыть сделку #{conversation.latestOrder.id}
                      </Link>
                    </div>
                  </div>
                ) : canBuyProduct ? (
                  <BuyProductDialog
                    product={{
                      id: conversation.product.id,
                      title: conversation.product.title,
                      price: conversation.product.price,
                    }}
                  />
                ) : (
                  <p className="text-sm leading-7 text-zinc-400">
                    Заказ по этому товару пока не создан. Сначала обсудите детали с продавцом.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Исходный товар уже недоступен, но история диалога сохранена.
              </p>
            )}
          </div>
        </div>
      </section>

      <ConversationRoomView conversationId={conversation.id} />
    </main>
  );
}