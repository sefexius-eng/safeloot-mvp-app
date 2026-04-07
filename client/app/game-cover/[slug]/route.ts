const GAME_COVER_THEMES: Record<
  string,
  {
    title: string;
    genre: string;
    tagline: string;
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
  }
> = {
  "albion-online": {
    title: "Albion Online",
    genre: "Sandbox MMO",
    tagline: "Trade, guild wars, silver economy",
    primary: "#f97316",
    secondary: "#7c2d12",
    accent: "#fdba74",
    glow: "rgba(249,115,22,0.45)",
  },
  "apex-legends": {
    title: "Apex Legends",
    genre: "Battle Royale",
    tagline: "Squads, movement, arena pressure",
    primary: "#ef4444",
    secondary: "#7f1d1d",
    accent: "#fca5a5",
    glow: "rgba(239,68,68,0.42)",
  },
  "black-desert": {
    title: "Black Desert",
    genre: "MMORPG",
    tagline: "Silver, grind, lifeskills",
    primary: "#7c3aed",
    secondary: "#312e81",
    accent: "#c4b5fd",
    glow: "rgba(124,58,237,0.42)",
  },
  cs2: {
    title: "CS2",
    genre: "Tactical Shooter",
    tagline: "Skins, ranks, precision economy",
    primary: "#f97316",
    secondary: "#0f172a",
    accent: "#fde68a",
    glow: "rgba(249,115,22,0.4)",
  },
  dota2: {
    title: "Dota 2",
    genre: "MOBA",
    tagline: "Items, mmr, late-game control",
    primary: "#dc2626",
    secondary: "#3f0d12",
    accent: "#fca5a5",
    glow: "rgba(220,38,38,0.42)",
  },
  "ea-sports-fc-25": {
    title: "EA Sports FC 25",
    genre: "Football",
    tagline: "Coins, squads, Ultimate Team",
    primary: "#22c55e",
    secondary: "#14532d",
    accent: "#bbf7d0",
    glow: "rgba(34,197,94,0.42)",
  },
  "escape-from-tarkov": {
    title: "Escape from Tarkov",
    genre: "Extraction Shooter",
    tagline: "Loot, rubles, harsh raids",
    primary: "#84cc16",
    secondary: "#1f2937",
    accent: "#d9f99d",
    glow: "rgba(132,204,22,0.4)",
  },
  fortnite: {
    title: "Fortnite",
    genre: "Battle Royale",
    tagline: "V-Bucks, builds, seasonal drops",
    primary: "#06b6d4",
    secondary: "#4f46e5",
    accent: "#bfdbfe",
    glow: "rgba(6,182,212,0.42)",
  },
  "genshin-impact": {
    title: "Genshin Impact",
    genre: "Action RPG",
    tagline: "Crystals, rerolls, artifact grind",
    primary: "#38bdf8",
    secondary: "#0f172a",
    accent: "#fef3c7",
    glow: "rgba(56,189,248,0.4)",
  },
  "gta-5": {
    title: "GTA 5",
    genre: "Open World",
    tagline: "Accounts, cash, neon streets",
    primary: "#22c55e",
    secondary: "#111827",
    accent: "#f9a8d4",
    glow: "rgba(34,197,94,0.4)",
  },
  "league-of-legends": {
    title: "League of Legends",
    genre: "MOBA",
    tagline: "RP, boosting, champion mastery",
    primary: "#2563eb",
    secondary: "#1e3a8a",
    accent: "#fcd34d",
    glow: "rgba(37,99,235,0.42)",
  },
  minecraft: {
    title: "Minecraft",
    genre: "Sandbox",
    tagline: "Blocks, resources, cozy survival",
    primary: "#22c55e",
    secondary: "#365314",
    accent: "#fef08a",
    glow: "rgba(34,197,94,0.4)",
  },
  "path-of-exile": {
    title: "Path of Exile",
    genre: "ARPG",
    tagline: "Currency, builds, endgame maps",
    primary: "#d97706",
    secondary: "#292524",
    accent: "#fde68a",
    glow: "rgba(217,119,6,0.42)",
  },
  pubg: {
    title: "PUBG",
    genre: "Battle Royale",
    tagline: "UC, ranks, survival loadouts",
    primary: "#facc15",
    secondary: "#111827",
    accent: "#fde68a",
    glow: "rgba(250,204,21,0.4)",
  },
  roblox: {
    title: "Roblox",
    genre: "UGC Universe",
    tagline: "Robux, avatars, user creations",
    primary: "#ef4444",
    secondary: "#111827",
    accent: "#fecaca",
    glow: "rgba(239,68,68,0.4)",
  },
  rust: {
    title: "Rust",
    genre: "Survival",
    tagline: "Bases, resources, wipe economy",
    primary: "#ea580c",
    secondary: "#1c1917",
    accent: "#fdba74",
    glow: "rgba(234,88,12,0.42)",
  },
  valorant: {
    title: "Valorant",
    genre: "Tactical Shooter",
    tagline: "Agents, rank grind, Riot Points",
    primary: "#f43f5e",
    secondary: "#1f2937",
    accent: "#fecdd3",
    glow: "rgba(244,63,94,0.42)",
  },
  "war-thunder": {
    title: "War Thunder",
    genre: "Military Action",
    tagline: "Aircraft, tanks, premium grind",
    primary: "#0ea5e9",
    secondary: "#172554",
    accent: "#bae6fd",
    glow: "rgba(14,165,233,0.4)",
  },
  "world-of-tanks": {
    title: "World of Tanks",
    genre: "Armored Battles",
    tagline: "Gold, tanks, progression lines",
    primary: "#65a30d",
    secondary: "#1f2937",
    accent: "#d9f99d",
    glow: "rgba(101,163,13,0.42)",
  },
  wow: {
    title: "World of Warcraft",
    genre: "Fantasy MMO",
    tagline: "Gold, boosts, raid-ready chars",
    primary: "#2563eb",
    secondary: "#312e81",
    accent: "#fcd34d",
    glow: "rgba(37,99,235,0.42)",
  },
};

function getFallbackTheme(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  const fallbackTitle = normalizedSlug
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
  const hash = Array.from(normalizedSlug).reduce(
    (accumulator, symbol) => accumulator + symbol.charCodeAt(0),
    0,
  );
  const palettes = [
    {
      primary: "#f97316",
      secondary: "#1f2937",
      accent: "#fdba74",
      glow: "rgba(249,115,22,0.42)",
    },
    {
      primary: "#06b6d4",
      secondary: "#1e3a8a",
      accent: "#bae6fd",
      glow: "rgba(6,182,212,0.42)",
    },
    {
      primary: "#a855f7",
      secondary: "#312e81",
      accent: "#ddd6fe",
      glow: "rgba(168,85,247,0.42)",
    },
  ];
  const palette = palettes[hash % palettes.length];

  return {
    title: fallbackTitle || "Game Cover",
    genre: "Marketplace",
    tagline: "SafeLoot curated catalog",
    ...palette,
  };
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildTitleLines(title: string) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length > 16 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    currentLine = candidate;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 3);
}

function buildMonogram(title: string) {
  const words = title.split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 4)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase())
    .join("");
}

function buildSvg(slug: string) {
  const theme = GAME_COVER_THEMES[slug] ?? getFallbackTheme(slug);
  const titleLines = buildTitleLines(theme.title);
  const titleText = titleLines
    .map(
      (line, index) =>
        `<tspan x="56" dy="${index === 0 ? 0 : 64}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  const monogram = escapeXml(buildMonogram(theme.title));

  return `
    <svg width="600" height="800" viewBox="0 0 600 800" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="40" y1="0" x2="560" y2="800" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${theme.primary}" />
          <stop offset="0.5" stop-color="${theme.secondary}" />
          <stop offset="1" stop-color="#09090B" />
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="520" y2="520" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="rgba(255,255,255,0.18)" />
          <stop offset="1" stop-color="rgba(255,255,255,0.04)" />
        </linearGradient>
        <filter id="blurGlow" x="-80" y="-80" width="760" height="960" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feGaussianBlur stdDeviation="36" />
        </filter>
      </defs>
      <rect width="600" height="800" rx="40" fill="url(#bg)" />
      <circle cx="510" cy="120" r="120" fill="${theme.glow}" filter="url(#blurGlow)" />
      <circle cx="84" cy="706" r="110" fill="${theme.glow}" filter="url(#blurGlow)" />
      <rect x="32" y="32" width="536" height="736" rx="34" fill="rgba(9,9,11,0.16)" stroke="rgba(255,255,255,0.12)" />
      <rect x="56" y="56" width="220" height="38" rx="19" fill="rgba(9,9,11,0.34)" stroke="rgba(255,255,255,0.16)" />
      <text x="80" y="80" fill="#F8FAFC" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="4">SAFELOOT</text>
      <text x="56" y="148" fill="${theme.accent}" font-size="22" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="5">${escapeXml(theme.genre.toUpperCase())}</text>
      <g opacity="0.28">
        <path d="M354 96L520 96" stroke="rgba(255,255,255,0.28)" stroke-width="2" />
        <path d="M390 132L520 132" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
        <path d="M334 168L520 168" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
      </g>
      <text x="56" y="250" fill="#FFFFFF" font-size="60" font-family="Arial, Helvetica, sans-serif" font-weight="800">${titleText}</text>
      <rect x="56" y="458" width="488" height="170" rx="32" fill="url(#panel)" stroke="rgba(255,255,255,0.12)" />
      <text x="88" y="540" fill="rgba(255,255,255,0.94)" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(theme.tagline)}</text>
      <text x="88" y="588" fill="rgba(255,255,255,0.62)" font-size="18" font-family="Arial, Helvetica, sans-serif">Marketplace-ready themed cover</text>
      <rect x="404" y="478" width="112" height="112" rx="28" fill="rgba(9,9,11,0.34)" stroke="rgba(255,255,255,0.12)" />
      <text x="460" y="548" text-anchor="middle" fill="#FFFFFF" font-size="44" font-family="Arial, Helvetica, sans-serif" font-weight="800">${monogram}</text>
      <path d="M56 688C118 648 182 628 250 628C325 628 394 650 468 704" stroke="rgba(255,255,255,0.2)" stroke-width="3" stroke-linecap="round" />
      <path d="M56 716C138 678 216 660 300 660C376 660 448 676 520 714" stroke="${theme.accent}" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round" />
      <text x="56" y="742" fill="rgba(255,255,255,0.74)" font-size="18" font-family="Arial, Helvetica, sans-serif" letter-spacing="3">SAFE PAYOUTS • ESCROW • VERIFIED OFFERS</text>
    </svg>
  `;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const svg = buildSvg(slug);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}