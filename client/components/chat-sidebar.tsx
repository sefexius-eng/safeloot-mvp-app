"use client";

import Link from "next/link";
import { MoreHorizontal, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  deleteConversation,
  toggleArchiveConversation,
} from "@/app/actions/chat";
import CensoredText from "@/components/censored-text";
import { Button } from "@/components/ui/button";
import { CosmeticName } from "@/components/ui/cosmetic-name";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

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

type ChatSidebarTab = "active" | "archived";

function formatConversationTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ChatSidebar({ conversations }: ChatSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ChatSidebarTab>("active");
  const [conversationItems, setConversationItems] =
    useState<ChatSidebarConversation[]>(conversations);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatSidebarConversation | null>(null);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setConversationItems(conversations);
  }, [conversations]);

  const activeConversationsCount = useMemo(
    () => conversationItems.filter((conversation) => !conversation.isArchived).length,
    [conversationItems],
  );
  const archivedConversationsCount = useMemo(
    () => conversationItems.filter((conversation) => conversation.isArchived).length,
    [conversationItems],
  );
  const visibleConversations = useMemo(
    () =>
      conversationItems.filter((conversation) =>
        activeTab === "archived" ? conversation.isArchived : !conversation.isArchived,
      ),
    [activeTab, conversationItems],
  );
  const isDeleteDialogPending =
    Boolean(deleteTarget) && isPending && pendingConversationId === deleteTarget?.id;

  function handleDeleteDialogOpenChange(nextOpen: boolean) {
    if (isDeleteDialogPending) {
      return;
    }

    if (!nextOpen) {
      setDeleteTarget(null);
      setActionError(null);
    }
  }

  function handleArchiveToggle(chatId: string, nextArchivedState: boolean) {
    const previousConversations = conversationItems;

    setActionError(null);
    setPendingConversationId(chatId);
    setConversationItems((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === chatId
          ? {
              ...conversation,
              isArchived: nextArchivedState,
            }
          : conversation,
      ),
    );

    startTransition(() => {
      void toggleArchiveConversation(chatId)
        .then((result) => {
          if (!result.ok) {
            setConversationItems(previousConversations);
            setActionError(result.message ?? "Не удалось обновить архив чата.");
            return;
          }

          router.refresh();
        })
        .catch(() => {
          setConversationItems(previousConversations);
          setActionError("Не удалось обновить архив чата.");
        })
        .finally(() => {
          setPendingConversationId(null);
        });
    });
  }

  function handleDelete(chatId: string) {
    const previousConversations = conversationItems;
    const isDeletingActiveConversation = pathname.includes(chatId);

    setActionError(null);
    setPendingConversationId(chatId);
    setConversationItems((currentConversations) =>
      currentConversations.filter((conversation) => conversation.id !== chatId),
    );

    startTransition(() => {
      void deleteConversation(chatId)
        .then((result) => {
          if (!result.ok) {
            setConversationItems(previousConversations);
            setActionError(result.message ?? "Не удалось удалить чат.");
            return;
          }

          setDeleteTarget(null);

          if (isDeletingActiveConversation) {
            router.push("/chats");
          }

          router.refresh();
        })
        .catch(() => {
          setConversationItems(previousConversations);
          setActionError("Не удалось удалить чат.");
        })
        .finally(() => {
          setPendingConversationId(null);
        });
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-gray-800 px-4 py-4">
        <p className="text-xs font-semibold tracking-[0.22em] uppercase text-gray-500">
          SafeLoot Chats
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          Диалоги
        </h1>

        <div className="mt-4 inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={cn(
              "rounded-[1rem] px-3 py-2 text-sm font-medium transition",
              activeTab === "active"
                ? "bg-white text-zinc-950 shadow-[0_10px_30px_rgba(255,255,255,0.18)]"
                : "text-zinc-400 hover:bg-white/10 hover:text-white",
            )}
          >
            Все чаты
            <span className="ml-2 text-xs opacity-70">{activeConversationsCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("archived")}
            className={cn(
              "rounded-[1rem] px-3 py-2 text-sm font-medium transition",
              activeTab === "archived"
                ? "bg-white text-zinc-950 shadow-[0_10px_30px_rgba(255,255,255,0.18)]"
                : "text-zinc-400 hover:bg-white/10 hover:text-white",
            )}
          >
            Архив
            <span className="ml-2 text-xs opacity-70">{archivedConversationsCount}</span>
          </button>
        </div>

        {actionError ? (
          <p className="mt-3 text-sm text-rose-300">{actionError}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleConversations.length === 0 ? (
          <div className="px-4 py-6 text-sm leading-7 text-gray-500">
            {activeTab === "archived"
              ? "В архиве пока нет диалогов."
              : "У вас пока нет активных диалогов."}
          </div>
        ) : (
          visibleConversations.map((chat) => {
            const isActive = pathname.includes(chat.id);
            const displayName = chat.otherParty.name?.trim() || "Пользователь";
            const messagePreview = chat.lastMessage
              ? chat.lastMessage.text ||
                (chat.lastMessage.hasImage ? "[Скриншот]" : "Новое сообщение")
              : "Диалог только что создан.";
            const isActionPending = isPending && pendingConversationId === chat.id;

            return (
              <div
                key={chat.id}
                className={cn(
                  "group flex items-center gap-3 border-b border-gray-800/50 p-3 transition hover:bg-gray-800",
                  isActive ? "bg-gray-800" : "bg-transparent",
                )}
              >
                <Link
                  href={`/chats/${chat.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
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
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="truncate text-xs text-gray-500">
                        <CensoredText text={chat.product?.title ?? "Диалог без товара"} />
                      </p>
                      {chat.isArchived ? (
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                          Архив
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-400">
                      <CensoredText text={messagePreview} />
                    </p>
                  </div>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isActionPending}
                      className="h-9 w-9 shrink-0 rounded-xl border border-transparent text-zinc-400 opacity-100 shadow-none hover:border-white/10 hover:bg-white/10 hover:text-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="min-w-[200px]">
                    <DropdownMenuLabel>Действия с чатом</DropdownMenuLabel>
                    <DropdownMenuSeparator className="my-1 h-px bg-white/10" />
                    <DropdownMenuItem
                      disabled={isActionPending}
                      onSelect={(event) => {
                        event.preventDefault();
                        handleArchiveToggle(chat.id, !chat.isArchived);
                      }}
                    >
                      {chat.isArchived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                      {chat.isArchived ? "Вернуть из архива" : "В архив"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isActionPending}
                      className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 focus:bg-rose-500/10 focus:text-rose-200"
                      onSelect={(event) => {
                        event.preventDefault();
                        setActionError(null);
                        setDeleteTarget(chat);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Удалить чат
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <DialogContent className="border-white/10 bg-[#10151c] text-zinc-100 sm:max-w-md">
          <DialogHeader className="space-y-3 pr-10">
            <DialogTitle>Удалить чат?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Диалог с ${deleteTarget.otherParty.name?.trim() || "пользователем"} исчезнет из вашего списка чатов. История не удаляется из базы и снова появится, если в этот чат придёт новое сообщение.`
                : "Диалог исчезнет из вашего списка чатов, но при новом сообщении снова появится."}
            </DialogDescription>
          </DialogHeader>

          {deleteTarget?.product?.title ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
              Товар: <CensoredText text={deleteTarget.product.title} />
            </div>
          ) : null}

          {actionError ? <p className="text-sm text-rose-300">{actionError}</p> : null}

          <DialogFooter className="gap-3 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleDeleteDialogOpenChange(false)}
              disabled={isDeleteDialogPending}
              className="border border-white/10 bg-white/5 hover:bg-white/10"
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget.id);
                }
              }}
              disabled={!deleteTarget || isDeleteDialogPending}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              {isDeleteDialogPending ? "Удаляем..." : "Удалить чат"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}