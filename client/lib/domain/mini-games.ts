import type { ConversationGameType } from "@/lib/pusher";

interface MiniGameSidebarNote {
  title: string;
  body: string;
  tone: "neutral" | "sky" | "orange";
}

export interface MiniGameDefinition {
  title: string;
  words: readonly string[];
  activeRoundDrawerTitle: string;
  activeRoundGuesserTitle: string;
  drawerRoleDescription: string;
  guesserRoleDescription: string;
  drawerWordLabel: string;
  drawerWordLoadingLabel: string;
  guesserObservationLabel: string;
  guesserObservationDescription: string;
  drawerCanvasHint: string;
  guessInputPlaceholder: string;
  guessSubmitLabel: string;
  guessFeedEmptyLabel: string;
  sidebarNotes: readonly MiniGameSidebarNote[];
}

const CROCODILE_GAME_DEFINITION: MiniGameDefinition = {
  title: "Крокодил",
  words: ["Яблоко", "Машина", "Кот", "Программист"],
  activeRoundDrawerTitle: "Покажите слово жестами и рисунком",
  activeRoundGuesserTitle: "Наблюдайте за рисунком и угадывайте",
  drawerRoleDescription:
    "Показывает слово через рисунок. Прямые подсказки и написание слова запрещены.",
  guesserRoleDescription:
    "Смотрит на холст в реальном времени и отправляет версии ответа прямо из окна игры.",
  drawerWordLabel: "Ваше слово",
  drawerWordLoadingLabel: "Подбираем слово...",
  guesserObservationLabel: "Режим наблюдения",
  guesserObservationDescription:
    "Следите за линиями на холсте и пытайтесь угадать предмет, персонажа или профессию.",
  drawerCanvasHint:
    "Рисуйте мышкой или пальцем. Каждое движение сразу отправляется второму игроку через realtime channel.",
  guessInputPlaceholder: "Введите вашу догадку",
  guessSubmitLabel: "Проверить",
  guessFeedEmptyLabel:
    "Пока нет попыток. Первые версии ответа появятся здесь в реальном времени.",
  sidebarNotes: [
    {
      title: "Подсказка",
      body: "Лучше начинать с общей формы предмета, а потом переходить к деталям. Так угадывание идёт заметно быстрее.",
      tone: "neutral",
    },
    {
      title: "Синхронизация",
      body: "Используются client-events Pusher, поэтому рисунок идёт в обход базы данных и появляется почти без задержки.",
      tone: "orange",
    },
  ],
};

export const MINI_GAME_REGISTRY: Record<ConversationGameType, MiniGameDefinition> = {
  crocodile: CROCODILE_GAME_DEFINITION,
};

export function getMiniGameDefinition(game: ConversationGameType) {
  return MINI_GAME_REGISTRY[game];
}

export function pickRandomMiniGameWord(game: ConversationGameType) {
  const definition = getMiniGameDefinition(game);
  const { words } = definition;

  if (words.length === 0) {
    throw new Error(`Mini-game ${game} has no configured words.`);
  }

  return words[Math.floor(Math.random() * words.length)] ?? words[0];
}