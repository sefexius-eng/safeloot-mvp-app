import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CensoredText from "@/components/censored-text";
import { UserAvatar } from "@/components/ui/user-avatar";
import { BuyProductDialog } from "@/components/product/buy-product-dialog";
import { ConversationRoomView } from "@/components/chat/conversation-room-view";
import { TeamBadge } from "@/components/ui/team-badge";
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
  const otherPartyName = conversation.otherParty.name?.trim() || conversation.otherParty.email;
  const canBuyProduct =
    conversation.product &&
    !conversation.latestOrder &&
    currentUser.id === conversation.buyerId;
  const purchasableProduct = canBuyProduct ? conversation.product : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-gray-800 bg-[#11151b] px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              src={conversation.otherParty.image}
              name={otherPartyName}
              email={conversation.otherParty.email}
              className="h-12 w-12 shrink-0 border-gray-700 bg-zinc-800/80"
              imageClassName="rounded-full object-cover"
            />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2 text-lg font-semibold text-white">
                <p className="truncate">
                  <CensoredText text={otherPartyName} />
                </p>
                <TeamBadge role={conversation.otherParty.accountRole} />
              </div>
              <p className="truncate text-sm text-gray-400">
                <CensoredText text={conversation.product?.title ?? "Личный диалог"} />
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            {statusMeta && conversation.latestOrder ? (
              <>
                <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
                <Link
                  href={`/orders/${conversation.latestOrder.id}`}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 px-5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
                >
                  Перейти к заказу
                </Link>
              </>
            ) : purchasableProduct ? (
              <div className="w-full sm:w-[180px]">
                <BuyProductDialog
                  product={{
                    id: purchasableProduct.id,
                    title: purchasableProduct.title,
                    price: purchasableProduct.price,
                  }}
                />
              </div>
            ) : (
              <span className="inline-flex rounded-full border border-gray-800 bg-gray-900/80 px-3 py-1.5 text-sm text-gray-400">
                {conversation.product ? "Диалог по товару без заказа" : "Товар недоступен"}
              </span>
            )}
          </div>
        </div>
      </header>

      <ConversationRoomView conversationId={conversation.id} />
    </div>
  );
}