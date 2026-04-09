"use client";

import { LogOut, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ChessMiniGame } from "@/components/chat/chess-mini-game";
import {
  endMiniGame,
  saveGameCanvasState,
  updateGameInviteStatus,
} from "@/app/actions/chat";
import { Button } from "@/components/ui/button";
import {
  getMiniGameDefinition,
  pickRandomMiniGameWord,
} from "@/lib/domain/mini-games";
import {
  getConversationChannelName,
  getPusherClient,
  PUSHER_GAME_CLEAR_EVENT,
  PUSHER_GAME_DRAW_EVENT,
  PUSHER_GAME_ENDED_EVENT,
  PUSHER_GAME_GUESS_EVENT,
  PUSHER_GAME_WIN_EVENT,
  type BrowserPusherChannel,
  type BrowserPusherClientEventChannel,
  type ConversationGameEndReason,
  type ConversationGameMetadata,
  type ConversationGameStatus,
  type ConversationGameType,
  type RealtimeGameClearPayload,
  type RealtimeGameEndedPayload,
  type RealtimeGameDrawPayload,
  type RealtimeGameGuessPayload,
  type RealtimeGameWinPayload,
} from "@/lib/pusher";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const STROKE_COLOR = "#111827";
const STROKE_WIDTH = 5;

interface DrawSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

interface GuessEntry {
  id: string;
  guess: string;
  authorLabel: string;
  matched: boolean;
}

interface WinState {
  winnerId: string;
  winnerLabel: string;
  word: string;
}

interface MiniGameContainerProps {
  conversationId: string;
  messageId: string;
  game: ConversationGameType;
  status: ConversationGameStatus;
  sessionId: string;
  initiatorId: string;
  canvasSnapshot?: string | null;
  fen?: string | null;
  whitePlayerId?: string | null;
  blackPlayerId?: string | null;
  moveHistory?: string[] | null;
  initiatorName: string;
  guesserName: string;
  currentUserId: string;
  onGameMetadataUpdate?: (
    messageId: string,
    nextGameMetadata: ConversationGameMetadata,
  ) => void;
  onClose: () => void;
}

function isMiniGameSessionClosed(status: ConversationGameStatus) {
  return status === "completed" || status === "ended" || status === "canceled";
}

function getMiniGameEndConfirmationMessage(reason: ConversationGameEndReason) {
  return reason === "surrender"
    ? "Вы уверены, что хотите завершить игру?\n\nВ шахматах это будет засчитано как поражение."
    : "Вы уверены, что хотите завершить игру?";
}

function CrocodileMiniGame({
  conversationId,
  messageId,
  game,
  status,
  sessionId,
  initiatorId,
  canvasSnapshot,
  initiatorName,
  guesserName,
  currentUserId,
  onGameMetadataUpdate,
  onClose,
}: MiniGameContainerProps) {
  const gameDefinition = getMiniGameDefinition(game);
  const title = gameDefinition.title;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pusherChannelRef = useRef<BrowserPusherChannel | null>(null);
  const closingTimerRef = useRef<number | null>(null);
  const saveCanvasTimerRef = useRef<number | null>(null);
  const queuedCanvasSnapshotRef = useRef<string | null>(null);
  const lastSavedCanvasSnapshotRef = useRef<string | null>(canvasSnapshot?.trim() || null);
  const snapshotDrawTokenRef = useRef(0);
  const drawingStateRef = useRef<{
    isDrawing: boolean;
    lastPoint: { x: number; y: number } | null;
  }>({
    isDrawing: false,
    lastPoint: null,
  });
  const secretWordRef = useRef("");
  const isSubscribedRef = useRef(false);
  const isCompletingGameRef = useRef(false);
  const [guesses, setGuesses] = useState<GuessEntry[]>([]);
  const [guessDraft, setGuessDraft] = useState("");
  const [secretWord, setSecretWord] = useState<string | null>(null);
  const [winState, setWinState] = useState<WinState | null>(null);
  const [connectionWarning, setConnectionWarning] = useState<string | null>(null);
  const [isCompletingGame, startCompletingGameTransition] = useTransition();
  const [isEndingGame, startEndingGameTransition] = useTransition();
  const isDrawer = currentUserId === initiatorId;
  const drawerRoleLabel = isDrawer ? "Вы как Рисующий" : `${initiatorName} как Рисующий`;
  const guesserRoleLabel = isDrawer ? "Угадывающий" : "Вы как Угадывающий";
  const isSessionClosed = isMiniGameSessionClosed(status) || Boolean(winState);
  const isReadOnlyCanvas = !isDrawer || isSessionClosed;
  const roundStatusLabel =
    status === "completed"
      ? "Раунд завершён"
      : status === "ended" || status === "canceled"
        ? "Раунд остановлен"
        : "Раунд активен";
  const wordStorageKey = useMemo(
    () => `mini-game-word:${game}:${sessionId}:${initiatorId}`,
    [game, initiatorId, sessionId],
  );

  function getRandomWord() {
    return pickRandomMiniGameWord(game);
  }

  function normalizeGuess(value: string) {
    return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
  }

  function getCanvasContext() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = STROKE_COLOR;
    context.lineWidth = STROKE_WIDTH;

    return context;
  }

  function resetCanvas() {
    const canvas = canvasRef.current;
    const context = getCanvasContext();

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawSegment(segment: DrawSegment) {
    const context = getCanvasContext();

    if (!context) {
      return;
    }

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = segment.color;
    context.beginPath();
    context.moveTo(segment.startX, segment.startY);
    context.lineTo(segment.endX, segment.endY);
    context.stroke();
  }

  function appendSegment(segment: DrawSegment) {
    drawSegment(segment);
  }

  function drawCanvasSnapshot(imageData: string) {
    const canvas = canvasRef.current;
    const context = getCanvasContext();

    if (!canvas || !context) {
      return;
    }

    const drawToken = ++snapshotDrawTokenRef.current;
    const snapshotImage = new window.Image();

    snapshotImage.onload = () => {
      if (snapshotDrawTokenRef.current !== drawToken) {
        return;
      }

      resetCanvas();
      context.drawImage(snapshotImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    };

    snapshotImage.src = imageData;
  }

  function clearScheduledCanvasSave() {
    if (saveCanvasTimerRef.current) {
      window.clearTimeout(saveCanvasTimerRef.current);
      saveCanvasTimerRef.current = null;
    }
  }

  function scheduleCanvasStateSave() {
    if (!isDrawer || status !== "active" || winState) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const nextSnapshot = canvas.toDataURL("image/jpeg", 0.5);

    if (
      !nextSnapshot ||
      nextSnapshot === queuedCanvasSnapshotRef.current ||
      nextSnapshot === lastSavedCanvasSnapshotRef.current
    ) {
      return;
    }

    queuedCanvasSnapshotRef.current = nextSnapshot;
    clearScheduledCanvasSave();

    saveCanvasTimerRef.current = window.setTimeout(() => {
      saveCanvasTimerRef.current = null;

      const snapshotToPersist = queuedCanvasSnapshotRef.current;

      if (!snapshotToPersist) {
        return;
      }

      void (async () => {
        try {
          await saveGameCanvasState(conversationId, snapshotToPersist);
          lastSavedCanvasSnapshotRef.current = snapshotToPersist;

          setConnectionWarning((currentWarning) =>
            currentWarning === "Не удалось сохранить снимок холста."
              ? null
              : currentWarning,
          );
        } catch (error) {
          setConnectionWarning(
            error instanceof Error
              ? error.message
              : "Не удалось сохранить снимок холста.",
          );
        } finally {
          if (queuedCanvasSnapshotRef.current === snapshotToPersist) {
            queuedCanvasSnapshotRef.current = null;
          }
        }
      })();
    }, 700);
  }

  function clearCanvasState() {
    snapshotDrawTokenRef.current += 1;
    resetCanvas();
    drawingStateRef.current = {
      isDrawing: false,
      lastPoint: null,
    };
  }

  function triggerClientEvent(eventName: string, payload: unknown) {
    const channel = pusherChannelRef.current as BrowserPusherClientEventChannel | null;

    if (!channel || !isSubscribedRef.current || typeof channel.trigger !== "function") {
      return false;
    }

    try {
      return channel.trigger(eventName, payload);
    } catch (error) {
      console.error("[CROCODILE_CLIENT_EVENT_ERROR]", {
        eventName,
        error,
      });
      return false;
    }
  }

  function scheduleCloseAfterWin() {
    if (closingTimerRef.current) {
      window.clearTimeout(closingTimerRef.current);
    }

    closingTimerRef.current = window.setTimeout(() => {
      onClose();
    }, 1800);
  }

  function handleEndGame() {
    if (status !== "active" || winState || isEndingGame) {
      return;
    }

    const shouldEndGame = window.confirm(
      getMiniGameEndConfirmationMessage("cancel"),
    );

    if (!shouldEndGame) {
      return;
    }

    startEndingGameTransition(() => {
      void (async () => {
        try {
          const result = await endMiniGame(messageId, "cancel");

          if (result.message.gameMetadata) {
            onGameMetadataUpdate?.(messageId, result.message.gameMetadata);
          }

          const wasTriggered = triggerClientEvent(PUSHER_GAME_ENDED_EVENT, {
            messageId,
            reason: "cancel",
          } satisfies RealtimeGameEndedPayload);

          if (!wasTriggered) {
            setConnectionWarning(
              "Не удалось мгновенно синхронизировать завершение игры через Pusher. Сессия закроется после обновления чата.",
            );
          } else {
            setConnectionWarning(null);
          }

          onClose();
        } catch (error) {
          setConnectionWarning(
            error instanceof Error
              ? error.message
              : "Не удалось завершить игровую сессию.",
          );
        }
      })();
    });
  }

  function resolveSecretWord() {
    if (!isDrawer) {
      setSecretWord(null);
      secretWordRef.current = "";
      return;
    }

    try {
      const storedWord = sessionStorage.getItem(wordStorageKey)?.trim();
      const nextWord = storedWord || getRandomWord();

      sessionStorage.setItem(wordStorageKey, nextWord);
      secretWordRef.current = nextWord;
      setSecretWord(nextWord);
    } catch {
      const fallbackWord = getRandomWord();

      secretWordRef.current = fallbackWord;
      setSecretWord(fallbackWord);
    }
  }

  function addGuessEntry(entry: GuessEntry) {
    setGuesses((currentGuesses) => [...currentGuesses.slice(-5), entry]);
  }

  function completeGame(nextWinState: WinState, shouldPersistCompletion: boolean) {
    setWinState(nextWinState);
    scheduleCloseAfterWin();

    if (!shouldPersistCompletion || isCompletingGameRef.current) {
      return;
    }

    isCompletingGameRef.current = true;
    startCompletingGameTransition(() => {
      void (async () => {
        try {
          await updateGameInviteStatus(conversationId, messageId, "completed");
        } catch (error) {
          setConnectionWarning(
            error instanceof Error
              ? error.message
              : "Не удалось завершить игровую сессию.",
          );
        }
      })();
    });
  }

  function getPointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(rect.width, 1);
    const scaleY = canvas.height / Math.max(rect.height, 1);
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    return {
      x: Math.min(canvas.width, Math.max(0, x)),
      y: Math.min(canvas.height, Math.max(0, y)),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (isReadOnlyCanvas) {
      return;
    }

    event.preventDefault();

    const nextPoint = getPointFromEvent(event);

    if (!nextPoint) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    drawingStateRef.current = {
      isDrawing: true,
      lastPoint: nextPoint,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (isReadOnlyCanvas || !drawingStateRef.current.isDrawing) {
      return;
    }

    event.preventDefault();

    const nextPoint = getPointFromEvent(event);
    const previousPoint = drawingStateRef.current.lastPoint;

    if (!nextPoint || !previousPoint) {
      return;
    }

    const segment: DrawSegment = {
      startX: previousPoint.x,
      startY: previousPoint.y,
      endX: nextPoint.x,
      endY: nextPoint.y,
      color: STROKE_COLOR,
    };

    appendSegment(segment);
    drawingStateRef.current.lastPoint = nextPoint;

    triggerClientEvent(PUSHER_GAME_DRAW_EVENT, {
      sessionId,
      ...segment,
    } satisfies RealtimeGameDrawPayload);
  }

  function handleClearCanvas() {
    if (isReadOnlyCanvas) {
      return;
    }

    clearCanvasState();
    scheduleCanvasStateSave();

    const wasTriggered = triggerClientEvent(PUSHER_GAME_CLEAR_EVENT, {
      sessionId,
    } satisfies RealtimeGameClearPayload);

    if (!wasTriggered) {
      setConnectionWarning(
        "Не удалось синхронизировать очистку холста через Pusher. Убедитесь, что client events включены в настройках приложения.",
      );
    }
  }

  function stopDrawing(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    drawingStateRef.current = {
      isDrawing: false,
      lastPoint: null,
    };
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    stopDrawing(event);
    scheduleCanvasStateSave();
  }

  useEffect(() => {
    const nextCanvasSnapshot = canvasSnapshot?.trim() || null;

    lastSavedCanvasSnapshotRef.current = nextCanvasSnapshot;

    if (nextCanvasSnapshot) {
      drawCanvasSnapshot(nextCanvasSnapshot);
    } else {
      clearCanvasState();
    }

    resolveSecretWord();
  }, [canvasSnapshot, isDrawer, wordStorageKey]);

  useEffect(() => {
    return () => {
      clearScheduledCanvasSave();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let pusherChannel: BrowserPusherChannel | null = null;

    const handleSubscriptionSucceeded = () => {
      isSubscribedRef.current = true;
      setConnectionWarning(null);
    };

    const handleRemoteDraw = (payload: RealtimeGameDrawPayload) => {
      if (payload.sessionId !== sessionId || isDrawer || winState) {
        return;
      }

      const nextSegment: DrawSegment = {
        startX: payload.startX,
        startY: payload.startY,
        endX: payload.endX,
        endY: payload.endY,
        color: payload.color,
      };

      appendSegment(nextSegment);
    };

    const handleRemoteClear = (payload: RealtimeGameClearPayload) => {
      if (payload.sessionId !== sessionId || isDrawer || winState) {
        return;
      }

      clearCanvasState();
    };

    const handleRemoteGuess = (payload: RealtimeGameGuessPayload) => {
      if (payload.sessionId !== sessionId) {
        return;
      }

      addGuessEntry({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        guess: payload.guess,
        authorLabel: payload.guesserLabel,
        matched: false,
      });

      if (!isDrawer || !secretWordRef.current) {
        return;
      }

      if (normalizeGuess(payload.guess) !== normalizeGuess(secretWordRef.current)) {
        return;
      }

      const nextWinState: WinState = {
        winnerId: payload.guesserId,
        winnerLabel: payload.guesserLabel,
        word: secretWordRef.current,
      };

      triggerClientEvent(PUSHER_GAME_WIN_EVENT, {
        sessionId,
        word: nextWinState.word,
        winnerId: nextWinState.winnerId,
        winnerLabel: nextWinState.winnerLabel,
      } satisfies RealtimeGameWinPayload);
      completeGame(nextWinState, true);
    };

    const handleRemoteWin = (payload: RealtimeGameWinPayload) => {
      if (payload.sessionId !== sessionId) {
        return;
      }

      completeGame({
        winnerId: payload.winnerId,
        winnerLabel: payload.winnerLabel,
        word: payload.word,
      }, false);
    };

    const handleRemoteGameEnded = (payload: RealtimeGameEndedPayload) => {
      if (payload.messageId !== messageId) {
        return;
      }

      onClose();
    };

    void (async () => {
      const pusherClient = await getPusherClient();

      if (!pusherClient || isCancelled) {
        setConnectionWarning(
          "Не удалось подключиться к realtime-каналу игры. Проверьте Pusher client events.",
        );
        return;
      }

      pusherChannel = pusherClient.subscribe(getConversationChannelName(conversationId));
      pusherChannelRef.current = pusherChannel;
      pusherChannel.bind("pusher:subscription_succeeded", handleSubscriptionSucceeded);
      pusherChannel.bind(PUSHER_GAME_CLEAR_EVENT, handleRemoteClear);
      pusherChannel.bind(PUSHER_GAME_DRAW_EVENT, handleRemoteDraw);
      pusherChannel.bind(PUSHER_GAME_ENDED_EVENT, handleRemoteGameEnded);
      pusherChannel.bind(PUSHER_GAME_GUESS_EVENT, handleRemoteGuess);
      pusherChannel.bind(PUSHER_GAME_WIN_EVENT, handleRemoteWin);
    })();

    return () => {
      isCancelled = true;
      isSubscribedRef.current = false;

      if (closingTimerRef.current) {
        window.clearTimeout(closingTimerRef.current);
      }

      if (!pusherChannel) {
        return;
      }

      pusherChannel.unbind("pusher:subscription_succeeded", handleSubscriptionSucceeded);
      pusherChannel.unbind(PUSHER_GAME_CLEAR_EVENT, handleRemoteClear);
      pusherChannel.unbind(PUSHER_GAME_DRAW_EVENT, handleRemoteDraw);
      pusherChannel.unbind(PUSHER_GAME_ENDED_EVENT, handleRemoteGameEnded);
      pusherChannel.unbind(PUSHER_GAME_GUESS_EVENT, handleRemoteGuess);
      pusherChannel.unbind(PUSHER_GAME_WIN_EVENT, handleRemoteWin);
    };
  }, [conversationId, isDrawer, messageId, sessionId, status, winState]);

  function handleSubmitGuess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDrawer || isSessionClosed) {
      return;
    }

    const guess = guessDraft.trim();

    if (!guess) {
      return;
    }

    addGuessEntry({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      guess,
      authorLabel: "Вы",
      matched: false,
    });
    setGuessDraft("");

    const wasTriggered = triggerClientEvent(PUSHER_GAME_GUESS_EVENT, {
      sessionId,
      guess,
      guesserId: currentUserId,
      guesserLabel: "Угадывающий",
    } satisfies RealtimeGameGuessPayload);

    if (!wasTriggered) {
      setConnectionWarning(
        "Не удалось отправить догадку через Pusher. Убедитесь, что client events включены в настройках приложения.",
      );
    }
  }

  return (
    <div className="absolute inset-4 z-50 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Мини-игра в чате
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleEndGame}
            disabled={status !== "active" || Boolean(winState) || isCompletingGame || isEndingGame}
            className="gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-red-100 hover:bg-red-500/20"
          >
            <LogOut className="h-4 w-4" />
            <span>{isEndingGame ? "Завершаем..." : "Завершить"}</span>
          </Button>

          <Button
            variant="ghost"
            onClick={onClose}
            className="gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-zinc-100 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
            <span>Свернуть</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="rounded-[1.5rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_55%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(3,7,18,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
                  {roundStatusLabel}
                </p>
                <h3 className="mt-2 text-3xl font-semibold text-white">
                  {isDrawer
                    ? gameDefinition.activeRoundDrawerTitle
                    : gameDefinition.activeRoundGuesserTitle}
                </h3>
              </div>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/70">
                  Сессия
                </p>
                <p className="mt-1 font-mono text-sm text-emerald-50">{sessionId.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            {winState ? (
              <div className="mt-6 rounded-[1.35rem] border border-emerald-300/25 bg-emerald-400/12 px-5 py-4 text-emerald-50 shadow-[0_18px_42px_rgba(16,185,129,0.15)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100/75">
                  Угадано!
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {winState.winnerLabel} отгадал слово «{winState.word}»
                </p>
                <p className="mt-2 text-sm text-emerald-50/80">
                  Игра будет автоматически свёрнута через пару секунд.
                </p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Рисующий
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{drawerRoleLabel}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {gameDefinition.drawerRoleDescription}
                </p>
              </div>

              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Угадывающий
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{guesserRoleLabel}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {gameDefinition.guesserRoleDescription}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
              {isDrawer ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {gameDefinition.drawerWordLabel}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-4xl font-semibold text-white">
                      {secretWord ?? gameDefinition.drawerWordLoadingLabel}
                    </p>
                    <Button
                      variant="ghost"
                      onClick={handleClearCanvas}
                      disabled={isReadOnlyCanvas || isEndingGame}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 text-zinc-100 hover:bg-white/10"
                    >
                      Очистить холст
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {gameDefinition.guesserObservationLabel}
                  </p>
                  <p className="mt-2 text-lg leading-7 text-white">
                    {gameDefinition.guesserObservationDescription}
                  </p>
                </div>
              )}

              <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-white/10 bg-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerOut={stopDrawing}
                  onPointerCancel={stopDrawing}
                  className="w-full h-auto aspect-[4/3] touch-none bg-white rounded-md"
                />
              </div>

              {isDrawer ? (
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {gameDefinition.drawerCanvasHint}
                </p>
              ) : (
                <form onSubmit={handleSubmitGuess} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={guessDraft}
                    onChange={(event) => setGuessDraft(event.target.value)}
                    placeholder={gameDefinition.guessInputPlaceholder}
                    disabled={isSessionClosed || isCompletingGame || isEndingGame}
                    className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-sky-400/40"
                  />
                  <Button
                    type="submit"
                    disabled={!guessDraft.trim() || isSessionClosed || isCompletingGame || isEndingGame}
                    className="rounded-2xl bg-sky-500 px-5 text-white hover:bg-sky-400"
                  >
                    {gameDefinition.guessSubmitLabel}
                  </Button>
                </form>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {gameDefinition.sidebarNotes.map((note) => {
              const toneClassName =
                note.tone === "sky"
                  ? "border-sky-400/15 bg-sky-500/10"
                  : note.tone === "orange"
                    ? "border-orange-400/15 bg-orange-500/10"
                    : "border-white/10 bg-white/5";
              const titleClassName =
                note.tone === "sky"
                  ? "text-sky-100/70"
                  : note.tone === "orange"
                    ? "text-orange-100/70"
                    : "text-zinc-500";
              const bodyClassName =
                note.tone === "sky"
                  ? "text-sky-50/90"
                  : note.tone === "orange"
                    ? "text-orange-50/90"
                    : "text-zinc-200";

              return (
                <div key={note.title} className={`rounded-[1.35rem] border p-4 ${toneClassName}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${titleClassName}`}>
                    {note.title}
                  </p>
                  <p className={`mt-3 text-sm leading-7 ${bodyClassName}`}>
                    {note.body}
                  </p>
                </div>
              );
            })}

            <div className="rounded-[1.35rem] border border-sky-400/15 bg-sky-500/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100/70">
                Поток догадок
              </p>
              <div className="mt-3 space-y-2">
                {guesses.length > 0 ? (
                  guesses.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-sky-50/90"
                    >
                      <span className="font-semibold text-white">{entry.authorLabel}:</span> {entry.guess}
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-sky-50/80">
                    {gameDefinition.guessFeedEmptyLabel}
                  </p>
                )}
              </div>
            </div>

            {connectionWarning ? (
              <div className="rounded-[1.35rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-100">
                {connectionWarning}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MiniGameContainer(props: MiniGameContainerProps) {
  if (props.game === "chess") {
    return <ChessMiniGame {...props} />;
  }

  return <CrocodileMiniGame {...props} />;
}