export const CARD_SIZE = { width: 63, height: 88 };
export const MAX_CARDS = 160;
export const SUITS = [
  { id: "S", symbol: "♠", label: "葵扇", color: "#222925" },
  { id: "H", symbol: "♥", label: "紅心", color: "#bf3439" },
  { id: "D", symbol: "♦", label: "方磚", color: "#bf3439" },
  { id: "C", symbol: "♣", label: "梅花", color: "#222925" },
];
export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
export const TEMPLATES = {
  poker52: { label: "標準啤牌", detail: "52 張 · 4 種花色", count: 52 },
  poker54: { label: "啤牌連大小皇", detail: "54 張 · 加 2 張皇", count: 54 },
  uno108: { label: "UNO 類型", detail: "108 張 · 顏色及功能牌", count: 108 },
  custom: { label: "自訂卡牌", detail: "自由設定張數", count: 12 },
};
export const FRONT_MODES = [
  { id: "pure", label: "純啤牌", description: "經典花色與點數" },
  { id: "logo", label: "小 LOGO", description: "保留啤牌，加上標記" },
  { id: "image", label: "完整圖片", description: "相片或整張牌面" },
  { id: "text", label: "加入文字", description: "標題、說明或任務" },
];
export const BACK_PATTERNS = [
  { id: "classic", label: "經典花紋" },
  { id: "diamond", label: "菱格細紋" },
  { id: "lattice", label: "交織線紋" },
  { id: "plain", label: "簡約淨色" },
];
export const BACK_COLORS = ["#285c50", "#244d77", "#a33640", "#292c30"];
export const DEFAULT_SETTINGS = {
  deckName: "我的啤牌",
  copyright: "",
  logo: "",
  logoSize: 8,
  logoPosition: "bottom-center",
  front: {
    mode: "pure",
    art: "",
    fit: "cover",
    frame: "full",
    showIndices: false,
    title: "一起探索",
    body: "每一張牌，都有自己的故事。",
    footer: "",
  },
  back: {
    pattern: "classic",
    color: "#285c50",
    art: "",
    fit: "cover",
    frame: "white",
    showLogo: false,
    text: "",
  },
  print: {
    paper: "a4",
    perSheet: 9,
    flip: "long",
    cutMarks: true,
    offsetX: 0,
    offsetY: 0,
  },
};

const uid = () => crypto.randomUUID();
export const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, number))
    : fallback;
};
const text = (value, max = 600) =>
  typeof value === "string" ? value.slice(0, max) : "";
const choice = (value, options, fallback) =>
  options.includes(value) ? value : fallback;
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const safeImage = (value) =>
  typeof value === "string" &&
  /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(value)
    ? value
    : "";
const safeColor = (value, fallback) =>
  /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;

export function makePokerCards(includeJokers = false) {
  const cards = SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: uid(),
      kind: "poker",
      rank,
      suit: suit.id,
      number: `${rank}${suit.symbol}`,
      front: {},
    })),
  );
  if (includeJokers) {
    cards.push({
      id: uid(),
      kind: "joker",
      rank: "JOKER",
      suit: "",
      number: "大皇",
      color: "#bf3439",
      front: {},
    });
    cards.push({
      id: uid(),
      kind: "joker",
      rank: "JOKER",
      suit: "",
      number: "小皇",
      color: "#222925",
      front: {},
    });
  }
  return cards;
}

export function makeUnoCards() {
  const cards = [];
  const colors = [
    ["紅", "#cf4547"],
    ["黃", "#d6a52d"],
    ["綠", "#39875e"],
    ["藍", "#3571ab"],
  ];
  const add = (name, color, rank) =>
    cards.push({
      id: uid(),
      kind: "uno",
      rank: String(rank),
      suit: name,
      number: `${name} ${rank}`,
      color,
      front: {},
    });
  colors.forEach(([name, color]) => {
    add(name, color, 0);
    for (let rank = 1; rank <= 9; rank++) {
      add(name, color, rank);
      add(name, color, rank);
    }
    ["Skip", "Reverse", "+2"].forEach((rank) => {
      add(name, color, rank);
      add(name, color, rank);
    });
  });
  for (let i = 0; i < 4; i++) {
    add("萬用", "#292c30", "WILD");
    add("萬用", "#292c30", "+4");
  }
  return cards;
}

export function makeCustomCards(count = 12) {
  return Array.from(
    { length: Math.round(clamp(count, 1, MAX_CARDS, 12)) },
    (_, index) => ({
      id: uid(),
      kind: "custom",
      rank: "",
      suit: "",
      number: String(index + 1).padStart(2, "0"),
      front: { mode: "text", title: `卡牌 ${index + 1}`, body: "", footer: "" },
    }),
  );
}

export function makeDeck(template, count) {
  if (template === "poker54") return makePokerCards(true);
  if (template === "uno108") return makeUnoCards();
  if (template === "custom") return makeCustomCards(count);
  return makePokerCards();
}

export function createProject() {
  return {
    version: 2,
    template: "poker52",
    cards: makePokerCards(),
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

export function effectiveFront(card, settings) {
  return { ...settings.front, ...card.front };
}

// Whole-deck edits clear overrides only for the fields being edited. Other individual
// artwork/text survives a change of layout, and can be restored by switching back.
export function applyFrontPatch(project, patch, scope, activeId) {
  if (scope === "card") {
    return {
      ...project,
      cards: project.cards.map((card) =>
        card.id === activeId
          ? { ...card, front: { ...card.front, ...patch } }
          : card,
      ),
    };
  }
  return {
    ...project,
    settings: {
      ...project.settings,
      front: { ...project.settings.front, ...patch },
    },
    cards: project.cards.map((card) => ({
      ...card,
      front: Object.fromEntries(
        Object.entries(card.front).filter(([key]) => !(key in patch)),
      ),
    })),
  };
}

export function cardAsset(card) {
  if (card.kind === "joker")
    return card.number === "大皇" ||
      ["#bf3439", "#dc2626", "#ff0000"].includes(card.color?.toLowerCase())
      ? "J2"
      : "J1";
  if (
    card.kind === "poker" &&
    SUITS.some((suit) => suit.id === card.suit) &&
    RANKS.includes(card.rank)
  )
    return `${card.suit}${card.rank.toLowerCase()}`;
  return null;
}
export const cardSymbol = (card) =>
  SUITS.find((suit) => suit.id === card.suit)?.symbol || "";
export const cardColor = (card) =>
  SUITS.find((suit) => suit.id === card.suit)?.color || card.color || "#222925";
export const cardLabel = (card) =>
  card.number || `${card.rank}${cardSymbol(card)}`;

function normalizeFront(source, partial = false) {
  const data = isObject(source) ? source : {};
  const defaults = DEFAULT_SETTINGS.front;
  const result = {};
  const put = (key, value) => {
    if (!partial || key in data) result[key] = value;
  };
  put(
    "mode",
    choice(
      data.mode,
      FRONT_MODES.map((mode) => mode.id),
      defaults.mode,
    ),
  );
  put("art", safeImage(data.art));
  put("fit", choice(data.fit, ["cover", "contain"], defaults.fit));
  put("frame", choice(data.frame, ["full", "white"], defaults.frame));
  put(
    "showIndices",
    typeof data.showIndices === "boolean"
      ? data.showIndices
      : defaults.showIndices,
  );
  ["title", "body", "footer"].forEach((key) =>
    put(
      key,
      typeof data[key] === "string"
        ? text(data[key], key === "body" ? 600 : 80)
        : defaults[key],
    ),
  );
  return result;
}

function normalizeCard(source, index) {
  const data = isObject(source) ? source : {};
  const legacyRank =
    RANKS.find((candidate) =>
      SUITS.some((suit) => data.number === `${candidate}${suit.symbol}`),
    ) || (RANKS.includes(data.centerText) ? data.centerText : "");
  const legacySuit = SUITS.find((suit) =>
    [data.playSuit, data.note, String(data.number).slice(-1)].includes(
      suit.symbol,
    ),
  )?.id;
  const kind = choice(
    data.kind,
    ["poker", "joker", "uno", "custom"],
    legacySuit && legacyRank
      ? "poker"
      : data.centerText === "JOKER"
        ? "joker"
        : String(data.playColor).startsWith("#")
          ? "uno"
          : "custom",
  );
  const rank =
    kind === "poker"
      ? choice(data.rank || legacyRank, RANKS, "A")
      : text(data.rank || data.centerText, 20);
  const suit =
    kind === "poker"
      ? choice(
          data.suit || legacySuit,
          SUITS.map((item) => item.id),
          "S",
        )
      : text(data.suit || data.title, 20);
  const front = normalizeFront(data.front, true);
  if (!isObject(data.front)) {
    const art = safeImage(data.art);
    if (art) Object.assign(front, { mode: "image", art, showIndices: true });
    if (kind === "custom") {
      Object.assign(front, {
        mode: art ? "image" : "text",
        title: text(data.centerText || data.title, 80),
        body: text(data.note),
        footer:
          data.title && data.title !== data.centerText
            ? text(data.title, 80)
            : "",
      });
    } else {
      // Old defaults (Spade / A / ♠) should become a clean playing card, but
      // user-edited headings, descriptions and artwork must not be discarded.
      const defaultTitle =
        kind === "poker"
          ? { S: "Spade", H: "Heart", D: "Diamond", C: "Club" }[suit]
          : kind === "joker"
            ? "Joker"
            : String(data.number || "").split(" ")[0];
      const defaultNote =
        kind === "poker"
          ? SUITS.find((item) => item.id === suit)?.symbol
          : kind === "joker"
            ? data.number === "小皇" || data.playColor === "black"
              ? "小皇"
              : "大皇"
            : ["WILD", "+4"].includes(rank)
              ? "萬用牌"
              : defaultTitle;
      const editedTitle =
        typeof data.title === "string" && data.title !== defaultTitle
          ? text(data.title, 80)
          : "";
      const editedCenter =
        typeof data.centerText === "string" &&
        data.centerText !== rank &&
        !(kind === "joker" && data.centerText === "JOKER")
          ? text(data.centerText, 80)
          : "";
      const editedBody =
        typeof data.note === "string" && data.note !== defaultNote
          ? text(data.note)
          : "";
      if (editedTitle || editedCenter || editedBody) {
        Object.assign(front, {
          mode: art ? "image" : "text",
          showIndices: true,
          title: editedCenter || editedTitle,
          body: editedBody,
          footer: editedCenter && editedTitle ? editedTitle : "",
        });
      }
    }
  }
  return {
    id: text(data.id, 100) || uid(),
    kind,
    rank,
    suit,
    number:
      text(data.number, 30) ||
      (kind === "poker"
        ? `${rank}${SUITS.find((item) => item.id === suit).symbol}`
        : String(index + 1).padStart(2, "0")),
    ...(kind === "joker" || kind === "uno"
      ? {
          color: safeColor(
            data.color,
            data.playColor === "red"
              ? "#bf3439"
              : safeColor(data.playColor, "#222925"),
          ),
        }
      : {}),
    front,
  };
}

export function normalizeProject(source, { requireCards = false } = {}) {
  if (
    !isObject(source) ||
    (requireCards &&
      (!Array.isArray(source.cards) ||
        !source.cards.length ||
        source.cards.length > MAX_CARDS ||
        source.cards.some((card) => !isObject(card))))
  ) {
    throw new Error("請選擇有效的卡牌設計 JSON（1–160 張卡牌）。");
  }
  const legacy = !isObject(source.settings);
  const data = legacy ? source : source.settings;
  const front = legacy
    ? {
        ...(safeImage(data.frontUpload)
          ? { mode: "image", art: data.frontUpload }
          : {}),
      }
    : data.front;
  const back = isObject(data.back) ? data.back : {};
  const print = isObject(data.print) ? data.print : {};
  const cards =
    Array.isArray(source.cards) && source.cards.length
      ? source.cards.slice(0, MAX_CARDS).map(normalizeCard)
      : makePokerCards();
  const ids = new Set();
  cards.forEach((card) => {
    if (ids.has(card.id)) card.id = uid();
    ids.add(card.id);
  });
  return {
    version: 2,
    template: choice(source.template, Object.keys(TEMPLATES), "poker52"),
    cards,
    settings: {
      deckName: text(data.deckName, 80) || DEFAULT_SETTINGS.deckName,
      copyright:
        data.copyright === "COPY RIGHT Scout System"
          ? ""
          : text(data.copyright, 100),
      logo: safeImage(data.logo),
      logoSize: clamp(data.logoSize, 5, 16, 8),
      logoPosition: choice(
        data.logoPosition,
        ["bottom-center", "top-right", "bottom-left"],
        "bottom-center",
      ),
      front: normalizeFront(front),
      back: {
        pattern: choice(
          back.pattern || (data.backPattern === "custom" ? "upload" : ""),
          [...BACK_PATTERNS.map((item) => item.id), "upload"],
          "classic",
        ),
        color: safeColor(
          back.color || data.backColor,
          DEFAULT_SETTINGS.back.color,
        ),
        art: safeImage(back.art || data.backUpload),
        fit: choice(back.fit, ["cover", "contain"], "cover"),
        frame: choice(back.frame, ["full", "white"], "white"),
        showLogo: typeof back.showLogo === "boolean" ? back.showLogo : false,
        text: text(back.text, 60),
      },
      print: {
        paper: choice(print.paper || data.printSize, ["a4", "r3", "r4"], "a4"),
        perSheet: Number(print.perSheet || data.a4PerSheet) === 6 ? 6 : 9,
        flip: choice(print.flip, ["long", "short"], "long"),
        cutMarks: typeof print.cutMarks === "boolean" ? print.cutMarks : true,
        offsetX: clamp(print.offsetX, -3, 3, 0),
        offsetY: clamp(print.offsetY, -3, 3, 0),
      },
    },
  };
}
