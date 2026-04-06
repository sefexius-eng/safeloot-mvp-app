import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { listConversationsByUser } from "@/lib/marketplace";

function formatConversationTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function ChatsPage() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.isBanned) {
    redirect("/");
  }

  const conversations = await listConversationsByUser(currentUser.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.16),transparent_34%),rgba(9,9,11,0.92)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-10">
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
          Chats Hub
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.05]">
          Ваши диалоги
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">
          Здесь собраны все личные переписки с продавцами и покупателями, даже если заказ еще не был оформлен.
        </p>
      </section>

      {conversations.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 px-6 py-14 text-center shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
            Пока пусто
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            У вас еще нет активных диалогов.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            Откройте любой товар и нажмите «Написать продавцу», чтобы создать первый чат.
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {conversations.map((conversation) => {
            const otherPartyName =
              conversation.otherParty.name?.trim() || conversation.otherParty.email;
            const lastMessagePreview = conversation.lastMessage
              ? conversation.lastMessage.text ||
                (conversation.lastMessage.hasImage ? "[Скриншот]" : "Новое сообщение")
              : "Диалог только что создан.";

            return (
              <Link
                key={conversation.id}
                href={`/chats/${conversation.id}`}
                className="group rounded-[1.8rem] border border-white/10 bg-white/5 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:border-orange-500/25 hover:bg-white/7"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        {conversation.product?.title ?? "Без привязки к товару"}
                      </span>
                      <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
                        {otherPartyName}
                      </span>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white transition group-hover:text-orange-200">
                      Диалог по товару
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-zinc-300">
                      {lastMessagePreview}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-[1.35rem] border border-white/10 bg-black/20 px-4 py-3 text-right text-sm text-zinc-300">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Последняя активность
                    </p>
                    <p className="mt-2 font-semibold text-white">
                      {formatConversationTime(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}
                    </p>
                    {conversation.product?.price ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Цена товара: {conversation.product.price} USDT
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}