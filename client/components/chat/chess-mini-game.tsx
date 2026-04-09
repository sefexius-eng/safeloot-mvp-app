"use client";

import { Chess, type Color, type Square } from "chess.js";
import { LogOut, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Chessboard } from "react-chessboard";

import {
  endMiniGame,
  saveChessGameState,
  updateGameInviteStatus,
} from "@/app/actions/chat";
import { Button } from "@/components/ui/button";
import {
  getConversationChannelName,
  getPusherClient,
  PUSHER_GAME_CHESS_MOVE_EVENT,
  PUSHER_GAME_ENDED_EVENT,
  type BrowserPusherChannel,
  type BrowserPusherClientEventChannel,
  type ConversationGameMetadata,
  type ConversationGameStatus,
  type RealtimeGameEndedPayload,
  type RealtimeGameChessMovePayload,
} from "@/lib/pusher";

const DEFAULT_CHESS_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface ChessMiniGameProps {
  conversationId: string;
  messageId: string;
  status: ConversationGameStatus;
  sessionId: string;
  initiatorId: string;
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

interface ChessResultSummary {
  title: string;
  body: string;
}

function createChessGame(fen?: string | null) {
  try {
    return fen?.trim() ? new Chess(fen.trim()) : new Chess();
  } catch {
    return new Chess(DEFAULT_CHESS_FEN);
  }
}

function createChessGameFromMetadata(input: {
  fen?: string | null;
  moveHistory?: string[] | null;
}) {
  const history = input.moveHistory ?? [];

  if (history.length > 0) {
    try {
      const game = new Chess();

      for (const move of history) {
        game.move(move);
      }

      if (!input.fen?.trim() || game.fen() === input.fen.trim()) {
        return game;
      }
    } catch {
      // Fall back to FEN-only hydration.
    }
  }

  return createChessGame(input.fen);
}

function findKingSquare(game: Chess, color: Color) {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
  const board = game.board();

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    const row = board[rowIndex];

    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const piece = row[columnIndex];

      if (piece?.type === "k" && piece.color === color) {
        return `${files[columnIndex]}${8 - rowIndex}`;
      }
    }
  }

  return null;
}

function getChessResultSummary(
  position: string,
  status: ConversationGameStatus,
): ChessResultSummary | null {
  const game = createChessGame(position);

  if (status === "ended") {
    return {
      title: "Партия завершена досрочно",
      body: "Один из игроков сдался, партия завершена досрочно.",
    };
  }

  if (status === "canceled") {
    return {
      title: "Партия остановлена",
      body: "Игровая сессия была завершена вручную.",
    };
  }

  if (game.isCheckmate()) {
    return {
      title: "Мат",
      body: game.turn() === "w" ? "Черные поставили мат." : "Белые поставили мат.",
    };
  }

  if (game.isStalemate()) {
    return {
      title: "Пат",
      body: "Партия завершилась патом.",
    };
  }

  if (game.isThreefoldRepetition()) {
    return {
      title: "Ничья",
      body: "Зафиксировано троекратное повторение позиции.",
    };
  }

  if (game.isDrawByFiftyMoves()) {
    return {
      title: "Ничья",
      body: "Сработало правило пятидесяти ходов.",
    };
  }

  if (game.isInsufficientMaterial()) {
    return {
      title: "Ничья",
      body: "Недостаточно материала для мата.",
    };
  }

  if (game.isDraw()) {
    return {
      title: "Ничья",
      body: "Партия завершилась вничью.",
    };
  }

  if (status === "completed") {
    return {
      title: "Партия завершена",
      body: "Игровая сессия была закрыта и сохранена в истории чата.",
    };
  }

  return null;
}

export function ChessMiniGame({
  conversationId,
  messageId,
  status,
  sessionId,
  initiatorId,
  fen,
  whitePlayerId,
  blackPlayerId,
  moveHistory,
  initiatorName,
  guesserName,
  currentUserId,
  onGameMetadataUpdate,
  onClose,
}: ChessMiniGameProps) {
  const initialGame = useMemo(
    () => createChessGameFromMetadata({ fen, moveHistory }),
    [fen, moveHistory],
  );
  const gameRef = useRef(initialGame);
  const pusherChannelRef = useRef<BrowserPusherChannel | null>(null);
  const isSubscribedRef = useRef(false);
  const isCompletingGameRef = useRef(false);
  const [position, setPosition] = useState(initialGame.fen());
  const [connectionWarning, setConnectionWarning] = useState<string | null>(null);
  const [isEndingGame, startEndingGameTransition] = useTransition();

  const normalizedWhitePlayerId = whitePlayerId?.trim() || initiatorId;
  const normalizedBlackPlayerId =
    blackPlayerId?.trim() ||
    (currentUserId === normalizedWhitePlayerId ? "" : currentUserId);
  const playerColor: Color = currentUserId === normalizedWhitePlayerId ? "w" : "b";
  const boardOrientation = playerColor === "w" ? "white" : "black";
  const whitePlayerLabel =
    currentUserId === normalizedWhitePlayerId ? "Вы" : initiatorName;
  const blackPlayerLabel =
    currentUserId === normalizedBlackPlayerId ? "Вы" : guesserName;
  const turnColor: Color = position.split(" ")[1] === "b" ? "b" : "w";
  const resultSummary = useMemo(
    () => getChessResultSummary(position, status),
    [position, status],
  );
  const isGameFinished =
    status === "completed" || status === "ended" || status === "canceled" || Boolean(resultSummary);
  const isPlayerTurn = turnColor === playerColor;
  const currentMoveHistory = useMemo(() => gameRef.current.history(), [position]);
  const verboseMoveHistory = useMemo(
    () => gameRef.current.history({ verbose: true }),
    [position],
  );
  const lastMove = verboseMoveHistory[verboseMoveHistory.length - 1] ?? null;
  const checkedKingSquare = useMemo(() => {
    if (!gameRef.current.isCheck() || gameRef.current.isGameOver()) {
      return null;
    }

    return findKingSquare(gameRef.current, gameRef.current.turn());
  }, [position]);
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: "rgba(251, 191, 36, 0.34)",
      };
      styles[lastMove.to] = {
        backgroundColor: "rgba(34, 197, 94, 0.34)",
      };
    }

    if (checkedKingSquare) {
      styles[checkedKingSquare] = {
        backgroundColor: "rgba(239, 68, 68, 0.32)",
        boxShadow: "inset 0 0 0 2px rgba(248, 113, 113, 0.85)",
      };
    }

    return styles;
  }, [checkedKingSquare, lastMove]);
  const moveRows = useMemo(() => {
    const rows: Array<{ moveNumber: number; white: string; black: string | null }> = [];

    for (let index = 0; index < currentMoveHistory.length; index += 2) {
      rows.push({
        moveNumber: Math.floor(index / 2) + 1,
        white: currentMoveHistory[index] ?? "",
        black: currentMoveHistory[index + 1] ?? null,
      });
    }

    return rows;
  }, [currentMoveHistory]);

  if (!fen?.trim() || !normalizedWhitePlayerId || !normalizedBlackPlayerId) {
    return (
      <div className="absolute inset-4 z-50 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Мини-игра в чате
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Шахматы</h2>
          </div>

          <Button
            variant="ghost"
            onClick={onClose}
            className="gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-zinc-100 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
            <span>Свернуть</span>
          </Button>
        </div>

        <div className="flex-1 p-5">
          <div className="rounded-[1.35rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-100">
            Для этой шахматной партии не хватает обязательных metadata-полей. Проверьте FEN и идентификаторы игроков в gameMetadata.
          </div>
        </div>
      </div>
    );
  }

  function buildMetadata(nextFen: string, nextStatus: ConversationGameStatus = status) {
    return {
      game: "chess" as const,
      status: nextStatus,
      initiatorId,
      sessionId,
      fen: nextFen,
      whitePlayerId: normalizedWhitePlayerId,
      blackPlayerId: normalizedBlackPlayerId,
      moveHistory: gameRef.current.history(),
    } satisfies ConversationGameMetadata;
  }

  function syncGamePosition(nextFen: string, nextMoveHistory?: string[] | null) {
    const nextGame = createChessGameFromMetadata({
      fen: nextFen,
      moveHistory: nextMoveHistory,
    });

    gameRef.current = nextGame;
    setPosition(nextGame.fen());
  }

  function triggerClientEvent(eventName: string, payload: unknown) {
    const channel = pusherChannelRef.current as BrowserPusherClientEventChannel | null;

    if (!channel || !isSubscribedRef.current || typeof channel.trigger !== "function") {
      return false;
    }

    try {
      return channel.trigger(eventName, payload);
    } catch (error) {
      console.error("[CHESS_CLIENT_EVENT_ERROR]", {
        eventName,
        error,
      });
      return false;
    }
  }

  function handleEndGame() {
    if (status !== "active" || isEndingGame) {
      return;
    }

    const shouldEndGame = window.confirm(
      "Вы уверены, что хотите завершить игру?\n\nВ шахматах это будет засчитано как поражение.",
    );

    if (!shouldEndGame) {
      return;
    }

    startEndingGameTransition(() => {
      void (async () => {
        try {
          const result = await endMiniGame(messageId, "surrender");

          if (result.message.gameMetadata) {
            onGameMetadataUpdate?.(messageId, result.message.gameMetadata);
          }

          const wasTriggered = triggerClientEvent(PUSHER_GAME_ENDED_EVENT, {
            messageId,
            reason: "surrender",
          } satisfies RealtimeGameEndedPayload);

          if (!wasTriggered) {
            setConnectionWarning(
              "Не удалось мгновенно синхронизировать завершение партии через Pusher. Сессия закроется после обновления чата.",
            );
          } else {
            setConnectionWarning(null);
          }

          onClose();
        } catch (error) {
          setConnectionWarning(
            error instanceof Error
              ? error.message
              : "Не удалось завершить шахматную партию.",
          );
        }
      })();
    });
  }

  function persistMove(nextFen: string, nextMoveHistory: string[], shouldCompleteGame: boolean) {
    void (async () => {
      try {
        const result = await saveChessGameState(
          conversationId,
          messageId,
          nextFen,
          nextMoveHistory,
        );

        if (result.gameMetadata) {
          onGameMetadataUpdate?.(messageId, result.gameMetadata);
        }

        if (shouldCompleteGame && !isCompletingGameRef.current) {
          isCompletingGameRef.current = true;
          await updateGameInviteStatus(conversationId, messageId, "completed");
        }

        setConnectionWarning((currentWarning) =>
          currentWarning === "Не удалось сохранить состояние шахматной партии."
            ? null
            : currentWarning,
        );
      } catch (error) {
        setConnectionWarning(
          error instanceof Error
            ? error.message
            : "Не удалось сохранить состояние шахматной партии.",
        );
      }
    })();
  }

  function handlePieceDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) {
    if (!targetSquare || status !== "active" || isGameFinished || !isPlayerTurn) {
      return false;
    }

    const movingPiece = gameRef.current.get(sourceSquare as Square);

    if (!movingPiece || movingPiece.color !== playerColor) {
      return false;
    }

    try {
      const isPromotionMove =
        movingPiece.type === "p" && (targetSquare.endsWith("1") || targetSquare.endsWith("8"));
      const move = gameRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        ...(isPromotionMove
          ? {
              promotion: "q",
            }
          : {}),
      });

      if (!move) {
        return false;
      }
    } catch {
      return false;
    }

    const nextFen = gameRef.current.fen();
    const nextMoveHistory = gameRef.current.history();
    const shouldCompleteGame = gameRef.current.isGameOver();

    setPosition(nextFen);
    onGameMetadataUpdate?.(messageId, buildMetadata(nextFen));

    const wasTriggered = triggerClientEvent(PUSHER_GAME_CHESS_MOVE_EVENT, {
      sessionId,
      fen: nextFen,
      moveHistory: nextMoveHistory,
    } satisfies RealtimeGameChessMovePayload);

    if (!wasTriggered) {
      setConnectionWarning(
        "Не удалось синхронизировать ход через Pusher. Проверьте client events в настройках приложения.",
      );
    }

    persistMove(nextFen, nextMoveHistory, shouldCompleteGame);

    return true;
  }

  useEffect(() => {
    const nextFen = createChessGameFromMetadata({ fen, moveHistory }).fen();

    if (nextFen !== gameRef.current.fen()) {
      syncGamePosition(nextFen, moveHistory);
    }
  }, [fen, moveHistory]);

  useEffect(() => {
    let isCancelled = false;
    let pusherChannel: BrowserPusherChannel | null = null;

    const handleSubscriptionSucceeded = () => {
      isSubscribedRef.current = true;
      setConnectionWarning(null);
    };

    const handleRemoteChessMove = (payload: RealtimeGameChessMovePayload) => {
      if (payload.sessionId !== sessionId || !payload.fen) {
        return;
      }

      const nextFen = createChessGameFromMetadata({
        fen: payload.fen,
        moveHistory: payload.moveHistory,
      }).fen();

      syncGamePosition(nextFen, payload.moveHistory);
      onGameMetadataUpdate?.(messageId, {
        ...buildMetadata(nextFen),
        moveHistory: payload.moveHistory,
      });
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
          "Не удалось подключиться к realtime-каналу шахматной партии.",
        );
        return;
      }

      pusherChannel = pusherClient.subscribe(getConversationChannelName(conversationId));
      pusherChannelRef.current = pusherChannel;
      pusherChannel.bind("pusher:subscription_succeeded", handleSubscriptionSucceeded);
      pusherChannel.bind(PUSHER_GAME_CHESS_MOVE_EVENT, handleRemoteChessMove);
      pusherChannel.bind(PUSHER_GAME_ENDED_EVENT, handleRemoteGameEnded);
    })();

    return () => {
      isCancelled = true;
      isSubscribedRef.current = false;

      if (!pusherChannel) {
        return;
      }

      pusherChannel.unbind("pusher:subscription_succeeded", handleSubscriptionSucceeded);
      pusherChannel.unbind(PUSHER_GAME_CHESS_MOVE_EVENT, handleRemoteChessMove);
      pusherChannel.unbind(PUSHER_GAME_ENDED_EVENT, handleRemoteGameEnded);
    };
  }, [conversationId, messageId, sessionId]);

  return (
    <div className="absolute inset-4 z-50 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Мини-игра в чате
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">Шахматы</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleEndGame}
            disabled={status !== "active" || isEndingGame || isGameFinished}
            className="gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-red-100 hover:bg-red-500/20"
          >
            <LogOut className="h-4 w-4" />
            <span>{isEndingGame ? "Завершаем..." : "Сдаться"}</span>
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-[1.5rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.2),transparent_55%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(3,7,18,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/80">
                  {status === "completed"
                    ? "Партия завершена"
                    : status === "ended"
                      ? "Поражение сдачей"
                      : status === "canceled"
                        ? "Партия остановлена"
                        : "Партия активна"}
                </p>
                <h3 className="mt-2 text-3xl font-semibold text-white">
                  {isPlayerTurn && status === "active"
                    ? "Ваш ход"
                    : status === "active"
                      ? "Ход соперника"
                      : "Ожидаем завершённую позицию"}
                </h3>
              </div>
              <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-100/70">
                  Сессия
                </p>
                <p className="mt-1 font-mono text-sm text-sky-50">{sessionId.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            {resultSummary ? (
              <div className="mt-6 rounded-[1.35rem] border border-amber-300/25 bg-amber-400/12 px-5 py-4 text-amber-50 shadow-[0_18px_42px_rgba(251,191,36,0.12)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/75">
                  {resultSummary.title}
                </p>
                <p className="mt-2 text-lg font-semibold">{resultSummary.body}</p>
              </div>
            ) : gameRef.current.isCheck() ? (
              <div className="mt-6 rounded-[1.35rem] border border-red-300/25 bg-red-500/12 px-5 py-4 text-red-50 shadow-[0_18px_42px_rgba(239,68,68,0.12)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-100/75">
                  Шах
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {gameRef.current.turn() === "w" ? "Белый" : "Черный"} король под шахом.
                </p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Белые
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{whitePlayerLabel}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  Играет снизу при белой ориентации и делает первый ход в партии.
                </p>
              </div>

              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Черные
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{blackPlayerLabel}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  Доска автоматически поворачивается к игроку своей стороной.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
              <div className="rounded-[1.25rem] border border-white/10 bg-[#0f172a] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-[1rem]">
                  <Chessboard
                    options={{
                      position,
                      boardOrientation,
                      onPieceDrop: handlePieceDrop,
                      squareStyles,
                      allowDragging: status === "active" && !isGameFinished,
                      canDragPiece: ({ piece }) =>
                        status === "active" &&
                        !isGameFinished &&
                        isPlayerTurn &&
                        piece.pieceType[0]?.toLowerCase() === playerColor,
                      boardStyle: {
                        borderRadius: "16px",
                        overflow: "hidden",
                      },
                      darkSquareStyle: {
                        backgroundColor: "#8b5e3c",
                      },
                      lightSquareStyle: {
                        backgroundColor: "#f1d9b5",
                      },
                    }}
                  />
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-300">
                Перетаскивайте фигуры мышкой или пальцем. Допустимые ходы проверяются через chess.js, а новая позиция одновременно уходит в realtime и сохраняется в базе данных.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.35rem] border border-sky-400/15 bg-sky-500/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100/70">
                Текущий статус
              </p>
              <p className="mt-3 text-sm leading-7 text-sky-50/90">
                {status === "completed"
                  ? "Партия завершена. Позиция сохранена в истории чата."
                  : status === "ended"
                    ? "Партия завершена досрочно. Сдача засчитана как поражение."
                    : status === "canceled"
                      ? "Игровая сессия была остановлена вручную."
                  : isPlayerTurn
                    ? "Сейчас ваш ход. Вы можете двигать только свои фигуры."
                    : "Сейчас ход соперника. Доска обновится сразу после его действия."}
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Сохранение позиции
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-200">
                После каждого корректного хода FEN сохраняется в базе данных, поэтому партия переживает перезагрузку вкладки и возврат в чат позже.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Правила хода
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-200">
                Нельзя двигать фигуры соперника и нельзя ходить вне своей очереди. При превращении пешки в этой версии автоматически выбирается ферзь.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                История ходов
              </p>
              <div className="mt-3 space-y-2">
                {moveRows.length > 0 ? (
                  moveRows.map((row) => (
                    <div
                      key={row.moveNumber}
                      className="grid grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)] gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"
                    >
                      <span className="font-mono text-zinc-500">{row.moveNumber}.</span>
                      <span className="font-medium text-white">{row.white}</span>
                      <span className="font-medium text-zinc-300">{row.black ?? "-"}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-zinc-300">
                    Партия только началась. Первый ход появится здесь сразу после перемещения фигуры.
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