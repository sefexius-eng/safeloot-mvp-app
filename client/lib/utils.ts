export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}

const LAST_SEEN_ONLINE_WINDOW_MS = 5 * 60 * 1000;

const LAST_SEEN_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

const LAST_SEEN_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function toValidDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalizedDate = value instanceof Date ? value : new Date(value);

  return Number.isFinite(normalizedDate.getTime()) ? normalizedDate : null;
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatLastSeen(date: Date | string | null | undefined) {
  const lastSeenDate = toValidDate(date);

  if (!lastSeenDate) {
    return "Был(а) в сети недавно";
  }

  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();

  if (diffMs < LAST_SEEN_ONLINE_WINDOW_MS) {
    return "🟢 Онлайн";
  }

  const formattedTime = LAST_SEEN_TIME_FORMATTER.format(lastSeenDate);

  if (isSameCalendarDay(lastSeenDate, now)) {
    return `Был(а) в сети сегодня в ${formattedTime}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameCalendarDay(lastSeenDate, yesterday)) {
    return `Был(а) в сети вчера в ${formattedTime}`;
  }

  return `Был(а) в сети ${LAST_SEEN_DATE_FORMATTER.format(lastSeenDate)} в ${formattedTime}`;
}