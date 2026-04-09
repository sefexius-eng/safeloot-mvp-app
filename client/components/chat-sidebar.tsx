"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import CensoredText from "@/components/censored-text";
import { CosmeticName } from "@/components/ui/cosmetic-name";
import { UserAvatar } from "@/components/ui/user-avatar";

export interface ChatSidebarConversation {
  id: string;
  updatedAt: string;
  isArchived: boolean;
  otherParty: {
    id: string;
    name: string | null;
    image: string | null;
    activeColor: string | null;
    activeFont: string | null;
    activeDecoration: string | null;
  };
  product: {
    id: string;
    title: string;
    price: string;
  } | null;
  lastMessage: {
    id: string;
    text: string;
    hasImage: boolean;
    createdAt: string;
    senderId: string;
  } | null;
}

interface ChatSidebarProps {
  conversations: ChatSidebarConversation[];
}

function formatConversationTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ChatSidebar({ conversations }: ChatSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-gray-800 px-4 py-4">
        <p className="text-xs font-semibold tracking-[0.22em] uppercase text-gray-500">
          SafeLoot Chats
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          Диалоги
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="px-4 py-6 text-sm leading-7 text-gray-500">
            У вас пока нет активных диалогов.
          </div>
        ) : (
          conversations.map((chat) => {
            const isActive = pathname.includes(chat.id);
            const displayName = chat.otherParty.name?.trim() || "Пользователь";
            const messagePreview = chat.lastMessage
              ? chat.lastMessage.text ||
                (chat.lastMessage.hasImage ? "[Скриншот]" : "Новое сообщение")
              : "Диалог только что создан.";

            return (
              <Link
                key={chat.id}
                href={`/chats/${chat.id}`}
                className={[
                  "flex items-center gap-3 border-b border-gray-800/50 p-3 transition hover:bg-gray-800 cursor-pointer",
                  isActive ? "bg-gray-800" : "bg-transparent",
                ].join(" ")}
              >
                <UserAvatar
                  src={chat.otherParty.image}
                  name={displayName}
                  decoration={chat.otherParty.activeDecoration}
                  className="h-12 w-12 shrink-0 border-gray-700 bg-zinc-800/80"
                  imageClassName="rounded-full object-cover"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <CosmeticName
                      text={displayName}
                      appearance={chat.otherParty}
                      className="block truncate text-sm font-semibold text-white"
                    />
                    <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                      {formatConversationTime(chat.lastMessage?.createdAt ?? chat.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    <CensoredText text={chat.product?.title ?? "Диалог без товара"} />
                  </p>
                  <p className="mt-1 truncate text-sm text-gray-400">
                    <CensoredText text={messagePreview} />
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}