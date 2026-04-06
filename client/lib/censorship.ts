const RU_PROFANITY_PATTERNS = [
  "хуй",
  "ху[еяйл]",
  "хер",
  "хрен",
  "пизд",
  "(?:за|вы|по|про|на|от|у|под|раз)?еб(?:а|и|о|у|л|н|ш|щ|т)",
  "бля",
  "хуе",
  "пид(?:ор|ар|р|орас|орасин)",
  "педик",
  "г[ао]ндон",
  "мудак",
  "шлюх",
  "сука",
  "залуп",
  "долбо(?:е|ё)?б",
  "ниг(?:ер|г)",
  "негр(?:ы|а|у|ом|ам|ов)?",
];

const EN_PROFANITY_PATTERNS = [
  "fuck(?:er|ing|ed|s)?",
  "shit(?:ty|ting|ted|s)?",
  "bitch(?:es|y)?",
  "dick(?:head|s)?",
  "cock(?:head|s)?",
  "cunt(?:s)?",
  "whore(?:s)?",
  "slut(?:s)?",
  "asshole(?:s)?",
  "motherfuck(?:er|ing|ed|s)?",
  "pidor(?:as)?",
  "pidar(?:as)?",
  "pidoras",
  "pedik",
  "xuy",
  "huy",
  "hui",
  "huj",
  "(?:za|vy|po|pro|na|ot|u|pod|raz)?eb(?:a|i|o|u|l|n|sh|sch|t)",
  "yebat",
  "blya",
  "blyat",
  "suka",
  "mudak",
  "gandon",
  "gondon",
  "zalup",
  "nigger",
];

export const BANNED_WORDS = [
  ...RU_PROFANITY_PATTERNS,
  ...EN_PROFANITY_PATTERNS,
];

const RU_PROFANITY_SOURCE = RU_PROFANITY_PATTERNS.join("|");
const EN_PROFANITY_SOURCE = EN_PROFANITY_PATTERNS.join("|");
const ANY_PROFANITY_SOURCE = [RU_PROFANITY_SOURCE, EN_PROFANITY_SOURCE].join("|");

export const RU_PROFANITY_REGEX = new RegExp(RU_PROFANITY_SOURCE, "iu");
export const EN_PROFANITY_REGEX = new RegExp(EN_PROFANITY_SOURCE, "iu");
export const ANY_PROFANITY_REGEX = new RegExp(ANY_PROFANITY_SOURCE, "iu");

export interface CensorshipPart {
  value: string;
  isCensored: boolean;
}

const NORMALIZATION_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
};

function createGlobalProfanityRegex() {
  return new RegExp(ANY_PROFANITY_SOURCE, "giu");
}

export function normalizeProfanityText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/./g, (symbol) => NORMALIZATION_MAP[symbol] ?? symbol)
    .replace(/ё/g, "е")
    .replace(/[\s_.,/\\|+*~`'"^:;()\[\]{}<>-]+/g, " ")
    .trim();
}

export function containsProfanity(text: string) {
  if (!text) {
    return false;
  }

  const normalizedText = normalizeProfanityText(text);

  if (!normalizedText) {
    return false;
  }

  const collapsedText = normalizedText.replace(/\s+/g, "");

  return (
    RU_PROFANITY_REGEX.test(normalizedText) ||
    EN_PROFANITY_REGEX.test(normalizedText) ||
    RU_PROFANITY_REGEX.test(collapsedText) ||
    EN_PROFANITY_REGEX.test(collapsedText)
  );
}

export function applyCensorship(text: string, isEnabled: boolean) {
  if (!text) {
    return [] as CensorshipPart[];
  }

  if (!isEnabled) {
    return [{ value: text, isCensored: false }] as CensorshipPart[];
  }

  if (containsProfanity(text)) {
    return [{ value: text, isCensored: true }] as CensorshipPart[];
  }

  const parts: CensorshipPart[] = [];
  const pattern = createGlobalProfanityRegex();
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matchedText = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      parts.push({
        value: text.slice(lastIndex, matchIndex),
        isCensored: false,
      });
    }

    parts.push({
      value: matchedText,
      isCensored: true,
    });
    lastIndex = matchIndex + matchedText.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      value: text.slice(lastIndex),
      isCensored: false,
    });
  }

  return parts;
}