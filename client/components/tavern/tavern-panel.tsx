"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useSession } from "next-auth/react";

import { sendTavernMessage } from "@/app/actions/tavern";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  getGlobalTavernChannelName,
  getPusherClient,
  PUSHER_MESSAGE_EVENT,
  type BrowserPusherChannel,
  type RealtimeTavernMessagePayload,
} from "@/lib/pusher";
import { cn } from "@/lib/utils";

interface TavernPanelProps {
  initialMessages: RealtimeTavernMessagePayload[];
}

const MAX_TAVERN_MESSAGES = 60;
const MAX_TAVERN_MESSAGE_LENGTH = 280;

function formatTavernMessageTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function upsertTavernMessage(
  currentMessages: RealtimeTavernMessagePayload[],
  nextMessage: RealtimeTavernMessagePayload,
) {
  const messagesById = new Map<string, RealtimeTavernMessagePayload>();

  for (const message of currentMessages) {
    messagesById.set(message.id, message);
  }

  messagesById.set(nextMessage.id, nextMessage);

  return Array.from(messagesById.values())
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .slice(-MAX_TAVERN_MESSAGES);
}

function getMessageInitial(message: RealtimeTavernMessagePayload) {
  if (message.isSystem) {
    return "SL";
  }

  return message.displayName.slice(0, 1).toUpperCase() || "T";
}

function getTavernProfileHref(message: RealtimeTavernMessagePayload) {
  if (!message.user?.id) {
    return null;
  }

  return `/user/${message.user.id}`;
}

export function TavernPanel({ initialMessages }: TavernPanelProps) {
  const feedRef = useRef<HTMLDivElement | null>(null);
  const { status } = useSession();
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [messages, setMessages] = useState<RealtimeTavernMessagePayload[]>(
    initialMessages,
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const feed = feedRef.current;

    if (!feed) {
      return;
    }

    feed.scrollTo({
      top: feed.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    let isCancelled = false;
    let pusherChannel: BrowserPusherChannel | null = null;
    let pusherClient: Awaited<ReturnType<typeof getPusherClient>> = null;

    const handleRealtimeMessage = (message: RealtimeTavernMessagePayload) => {
      setMessages((currentMessages) => upsertTavernMessage(currentMessages, message));
      setErrorMessage("");
    };

    void (async () => {
      pusherClient = await getPusherClient();

      if (!pusherClient || isCancelled) {
        return;
      }

      pusherChannel = pusherClient.subscribe(getGlobalTavernChannelName());
      pusherChannel.bind(PUSHER_MESSAGE_EVENT, handleRealtimeMessage);
    })();

    return () => {
      isCancelled = true;

      if (!pusherChannel || !pusherClient) {
        return;
      }

      pusherChannel.unbind(PUSHER_MESSAGE_EVENT, handleRealtimeMessage);
      pusherClient.unsubscribe(getGlobalTavernChannelName());
    };
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const messageText = draft.trim();

    if (!messageText) {
      setErrorMessage("Введите сообщение перед отправкой.");
      return;
    }

    startTransition(() => {
      void sendTavernMessage(messageText)
        .then((result) => {
          if (!result.ok || !result.tavernMessage) {
            setErrorMessage(
              result.message ?? "Не удалось отправить сообщение в таверну.",
            );
            return;
          }

          setDraft("");
          setErrorMessage("");
          setMessages((currentMessages) =>
            upsertTavernMessage(currentMessages, result.tavernMessage!),
          );
        })
        .catch(() => {
          setErrorMessage("Не удалось отправить сообщение в таверну.");
        });
    });
  }

  const canSendMessage = status === "authenticated";

  return (
    <section className="overflow-hidden rounded-[2.2rem] border border-orange-500/15 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(15,23,42,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[0.9fr_1.4fr] lg:px-8 lg:py-8">
        <div className="flex flex-col justify-between rounded-[1.9rem] border border-white/10 bg-black/20 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-100">
              <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_18px_rgba(251,146,60,0.85)]" />
              Global Tavern
            </div>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Таверна SafeLoot
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300/85">
              Публичный лобби-чат для всего маркетплейса. Здесь видны живые сообщения игроков и системные анонсы о свежих покупках.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Доступ
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                Читать могут все, писать только авторизованные игроки.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-orange-500/20 bg-orange-500/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-100/80">
                Бот-информатор
              </p>
              <p className="mt-2 text-sm font-medium text-orange-50">
                Системные события о покупках подсвечиваются оранжевым акцентом.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.9rem] border border-white/10 bg-black/25 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur md:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Realtime Lobby
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {messages.length > 0
                  ? `${messages.length} последних сообщений`
                  : "Лента сообщений"}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
              Live
            </div>
          </div>

          <div
            ref={feedRef}
            className="mt-4 flex max-h-[28rem] min-h-[20rem] flex-col gap-3 overflow-y-auto pr-1"
          >
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[16rem] items-center justify-center rounded-[1.6rem] border border-dashed border-white/10 bg-white/5 px-6 text-center text-sm leading-7 text-zinc-400">
                Таверна пока молчит. Первое сообщение может задать тон всей ленте.
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "rounded-[1.45rem] border px-4 py-3 shadow-[0_12px_36px_rgba(0,0,0,0.16)]",
                    message.isSystem
                      ? "border-orange-500/25 bg-[linear-gradient(135deg,rgba(249,115,22,0.22),rgba(120,53,15,0.32))] text-orange-50"
                      : "border-white/10 bg-white/6 text-zinc-100",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {getTavernProfileHref(message) ? (
                      <Link
                        href={getTavernProfileHref(message)!}
                        className="shrink-0 transition hover:scale-[1.03] hover:opacity-95"
                        aria-label={`Открыть профиль ${message.displayName}`}
                      >
                        <UserAvatar
                          src={message.user?.image}
                          name={message.user?.name ?? message.displayName}
                          alt={`Аватар ${message.displayName}`}
                          className="h-10 w-10 border-white/10 bg-zinc-900/80 shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
                          imageClassName="rounded-full object-cover"
                        />
                      </Link>
                    ) : (
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-xs font-semibold uppercase shadow-[0_12px_28px_rgba(0,0,0,0.18)]",
                          message.isSystem
                            ? "border-orange-200/20 bg-orange-500/15 text-orange-50"
                            : "border-white/10 bg-black/20 text-white",
                        )}
                      >
                        {getMessageInitial(message)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getTavernProfileHref(message) ? (
                          <Link
                            href={getTavernProfileHref(message)!}
                            className="text-sm font-semibold text-white transition hover:text-orange-100 hover:underline underline-offset-4"
                          >
                            {message.displayName}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-white">
                            {message.displayName}
                          </p>
                        )}
                        {message.isSystem ? (
                          <span className="rounded-full border border-orange-200/20 bg-orange-950/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-100">
                            Информатор
                          </span>
                        ) : null}
                        <span className="text-xs text-zinc-300/70">
                          {formatTavernMessageTime(message.createdAt)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-2 whitespace-pre-wrap break-words text-sm leading-7",
                          message.isSystem ? "text-orange-50" : "text-zinc-200",
                        )}
                      >
                        {message.text}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 border-t border-white/10 pt-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, MAX_TAVERN_MESSAGE_LENGTH))}
                rows={3}
                maxLength={MAX_TAVERN_MESSAGE_LENGTH}
                disabled={!canSendMessage || isPending}
                placeholder={
                  canSendMessage
                    ? "Напишите сообщение для всей таверны..."
                    : status === "loading"
                      ? "Проверяем сессию..."
                      : "Войдите в аккаунт, чтобы писать в таверну"
                }
                className="min-h-[96px] w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-7 text-zinc-100 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-70"
              />

              <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span>{draft.trim().length}/{MAX_TAVERN_MESSAGE_LENGTH}</span>
                  {errorMessage ? (
                    <span className="text-red-300">{errorMessage}</span>
                  ) : canSendMessage ? (
                    <span>Сообщение отправится всем посетителям страницы.</span>
                  ) : (
                    <Link href="/login" className="font-semibold text-orange-200 hover:text-orange-100">
                      Войти, чтобы писать
                    </Link>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={!canSendMessage || isPending || !draft.trim()}
                  className="rounded-2xl bg-orange-600 px-5 text-white hover:bg-orange-500"
                >
                  {isPending ? "Отправляем..." : "Отправить в таверну"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}