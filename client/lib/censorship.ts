export const BANNED_WORDS = [
  "негры",
  "негр",
  "пидорасина",
  "пидорас",
  "пидор",
  "пидрила",
  "матвей",
  "блядь",
  "блять",
  "сука",
  "ебать",
  "ебаный",
  "ебало",
  "хуй",
  "хуесос",
  "хуйня",
  "пизда",
  "пиздец",
  "мудак",
  "мразь",
  "шлюха",
  "гондон",
  "долбоеб",
];

export interface CensorshipPart {
  value: string;
  isCensored: boolean;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCensorshipPattern() {
  const escapedWords = BANNED_WORDS.map((word) => escapeRegExp(word)).sort(
    (left, right) => right.length - left.length,
  );

  return new RegExp(
    `(?<![\\p{L}\\p{N}_])(${escapedWords.join("|")})(?![\\p{L}\\p{N}_])`,
    "giu",
  );
}

export function applyCensorship(text: string, isEnabled: boolean) {
  if (!text) {
    return [] as CensorshipPart[];
  }

  if (!isEnabled) {
    return [{ value: text, isCensored: false }] as CensorshipPart[];
  }

  const parts: CensorshipPart[] = [];
  const pattern = getCensorshipPattern();
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