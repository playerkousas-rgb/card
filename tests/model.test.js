import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_SETTINGS,
  RANKS,
  SUITS,
  applyFrontPatch,
  cardAsset,
  createProject,
  effectiveFront,
  makeCustomCards,
  makePokerCards,
  makeUnoCards,
  normalizeProject,
  safeImage,
} from "../src/model.js";
import {
  deleteSavedDesign,
  loadSavedDesigns,
  saveDesignToBrowser,
} from "../src/storage.js";

const PNG = "data:image/png;base64,aGVsbG8=";

test("standard decks have every rank/suit once, and two distinct jokers when requested", () => {
  const cards = makePokerCards();
  assert.equal(cards.length, 52);
  assert.equal(new Set(cards.map((card) => card.id)).size, 52);
  for (const suit of SUITS) {
    assert.deepEqual(
      cards.filter((card) => card.suit === suit.id).map((card) => card.rank),
      RANKS,
    );
  }
  const jokers = makePokerCards(true).filter((card) => card.kind === "joker");
  assert.equal(jokers.length, 2);
  assert.deepEqual(
    jokers.map((card) => cardAsset(card)),
    ["J2", "J1"],
  );
});

test("all 54 standard faces exist locally; the ace has no printed website/QR branding", () => {
  for (const card of makePokerCards(true))
    assert.ok(
      fs.existsSync(
        new URL(`../public/cards/${cardAsset(card)}.svg`, import.meta.url),
      ),
    );
  const ace = fs.readFileSync(
    new URL("../public/cards/Sa.svg", import.meta.url),
    "utf8",
  );
  assert.ok(!ace.includes("www.me.uk"));
  assert.ok(!ace.includes("<text"));
  assert.ok(!ace.includes("m0-34.098"));
  assert.ok(
    fs.existsSync(new URL("../public/cards/LICENSE.txt", import.meta.url)),
  );
});

test("UNO deck remains 108 cards, including 4 Wild and 4 +4 cards", () => {
  const cards = makeUnoCards();
  assert.equal(cards.length, 108);
  assert.equal(cards.filter((card) => card.rank === "WILD").length, 4);
  assert.equal(cards.filter((card) => card.rank === "+4").length, 4);
  assert.equal(cards.filter((card) => card.rank === "0").length, 4);
});

test("custom counts are finite integers in the supported range", () => {
  assert.equal(makeCustomCards(0).length, 1);
  assert.equal(makeCustomCards(999).length, 160);
  assert.equal(makeCustomCards("bad").length, 12);
  assert.equal(makeCustomCards(3.6).length, 4);
});

test("new projects are independent and default to real poker cards / A4 duplex", () => {
  const one = createProject();
  const two = createProject();
  one.settings.back.color = "#112233";
  assert.equal(two.settings.back.color, DEFAULT_SETTINGS.back.color);
  assert.equal(two.settings.front.mode, "pure");
  assert.equal(two.settings.front.replaceCenter, false);
  assert.equal(two.settings.front.showCenterSuit, false);
  assert.equal(two.settings.logoSize, 18);
  assert.equal(two.settings.logoPosition, "bottom-center");
  assert.equal(two.settings.logo, "");
  assert.equal(two.settings.back.text, "");
  assert.equal(two.settings.back.showLogo, false);
  assert.equal(two.settings.print.paper, "a4");
  assert.equal(two.settings.print.perSheet, 9);
  assert.equal(two.settings.print.flip, "long");
});

test("per-card changes do not leak into other cards or mutate the original project", () => {
  const project = createProject();
  const id = project.cards[1].id;
  const next = applyFrontPatch(
    project,
    { mode: "text", title: "積雲", replaceCenter: true },
    "card",
    id,
  );
  assert.equal(effectiveFront(next.cards[1], next.settings).title, "積雲");
  assert.equal(effectiveFront(next.cards[1], next.settings).replaceCenter, true);
  assert.equal(effectiveFront(next.cards[0], next.settings).mode, "pure");
  assert.equal(effectiveFront(next.cards[0], next.settings).replaceCenter, false);
  assert.deepEqual(project.cards[1].front, {});
});

test("whole-deck updates clear matching overrides but retain unrelated card content", () => {
  let project = createProject();
  project = applyFrontPatch(
    project,
    { mode: "image", art: PNG, title: "個別標題" },
    "card",
    project.cards[0].id,
  );
  const next = applyFrontPatch(project, { mode: "text" }, "deck");
  assert.equal(effectiveFront(next.cards[0], next.settings).mode, "text");
  assert.equal(next.cards[0].front.art, PNG);
  assert.equal(next.cards[0].front.title, "個別標題");
  const reset = applyFrontPatch(next, { art: "" }, "deck");
  assert.equal(effectiveFront(reset.cards[0], reset.settings).art, "");
});

test("version 2 export/import round-trips all artwork and print settings", () => {
  const project = createProject();
  project.settings.logo = PNG;
  project.settings.logoSize = 32;
  project.settings.front.replaceCenter = false;
  project.settings.back.art = PNG;
  project.settings.back.pattern = "upload";
  project.settings.print.flip = "short";
  project.settings.print.perSheet = 16;
  project.settings.print.offsetX = -0.7;
  project.cards[10].front = { mode: "image", art: PNG, showIndices: true };
  assert.deepEqual(
    normalizeProject(JSON.parse(JSON.stringify(project)), {
      requireCards: true,
    }),
    project,
  );
});

test("legacy JSON recovers missing suit fields, preserves artwork, and keeps custom A4 perSheet", () => {
  const old = {
    template: "poker52",
    deckName: "舊牌組",
    printSize: "a4",
    a4PerSheet: 52,
    backPattern: "custom",
    backUpload: PNG,
    copyright: "COPY RIGHT Scout System",
    cards: [
      {
        id: "old-a",
        number: "A♠",
        centerText: "A",
        note: "♠",
        title: "Spade",
        playColor: "black",
        playSuit: "",
        art: "",
      },
      {
        id: "old-2",
        number: "2♥",
        centerText: "2",
        note: "♥",
        playColor: "red",
        art: PNG,
      },
    ],
  };
  const project = normalizeProject(old, { requireCards: true });
  assert.equal(project.cards[0].kind, "poker");
  assert.equal(project.cards[0].suit, "S");
  assert.equal(cardAsset(project.cards[0]), "Sa");
  assert.equal(cardAsset(project.cards[1]), "H2");
  assert.equal(project.cards[1].front.art, PNG);
  assert.equal(project.settings.back.art, PNG);
  assert.equal(project.settings.back.pattern, "upload");
  assert.equal(project.settings.print.perSheet, 52);
  assert.equal(project.settings.copyright, "");
});

test("3R photo paper defaults to 2 cards per sheet when normalized without perSheet", () => {
  const project = normalizeProject({
    settings: { print: { paper: "r3" } },
    cards: makePokerCards().slice(0, 4),
  });
  assert.equal(project.settings.print.paper, "r3");
  assert.equal(project.settings.print.perSheet, 2);
});

test("malformed imports fail clearly; duplicate card IDs are repaired", () => {
  for (const source of [
    null,
    [],
    {},
    { cards: [] },
    { cards: [null] },
    { cards: Array(161).fill({}) },
  ]) {
    assert.throws(
      () => normalizeProject(source, { requireCards: true }),
      /JSON/,
    );
  }
  const project = createProject();
  project.cards[1].id = project.cards[0].id;
  const imported = normalizeProject(project, { requireCards: true });
  assert.equal(new Set(imported.cards.map((card) => card.id)).size, 52);
});

test("unknown settings, invalid colors, non-finite offsets and external image URLs are sanitized", () => {
  const project = createProject();
  project.settings.back.color = "red";
  project.settings.back.pattern = "strange";
  project.settings.print.offsetX = Infinity;
  project.settings.print.offsetY = 100;
  project.settings.front.mode = "invalid";
  project.settings.logoSize = "bad";
  project.settings.logo = "https://example.com/tracker.png";
  const clean = normalizeProject(project, { requireCards: true });
  assert.equal(clean.settings.back.color, DEFAULT_SETTINGS.back.color);
  assert.equal(clean.settings.back.pattern, "classic");
  assert.equal(clean.settings.front.mode, "pure");
  assert.equal(clean.settings.print.offsetX, 0);
  assert.equal(clean.settings.print.offsetY, 3);
  assert.equal(clean.settings.logo, "");
  assert.equal(clean.settings.logoSize, 18);
  assert.equal(safeImage("javascript:alert(1)"), "");
});

test("legacy edited headings and notes survive migration alongside card artwork", () => {
  const legacy = {
    cards: [
      {
        id: "edited",
        number: "2♠",
        centerText: "積雲",
        title: "氣象卡",
        note: "晴天裡像棉花一樣的雲。",
        playColor: "black",
        art: "",
      },
      {
        id: "photo",
        number: "03",
        centerText: "相片卡",
        title: "活動名稱",
        note: "原本的補充文字",
        playColor: "black",
        art: PNG,
      },
    ],
  };
  const imported = normalizeProject(legacy, { requireCards: true });
  assert.equal(imported.cards[0].kind, "poker");
  assert.equal(imported.cards[0].rank, "2");
  assert.deepEqual(imported.cards[0].front, {
    mode: "text",
    showIndices: true,
    title: "積雲",
    body: "晴天裡像棉花一樣的雲。",
    footer: "氣象卡",
  });
  assert.equal(imported.cards[1].front.mode, "image");
  assert.equal(imported.cards[1].front.art, PNG);
  assert.equal(imported.cards[1].front.title, "相片卡");
  assert.equal(imported.cards[1].front.body, "原本的補充文字");
  assert.equal(imported.cards[1].front.footer, "活動名稱");
});

test("browser design library saves, updates, loads, and deletes designs via localStorage fallback", async () => {
  const store = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  });
  try {
    const first = createProject("poker52");
    first.settings.deckName = "氣象啤牌";
    const res1 = await saveDesignToBrowser(first);
    assert.equal(res1.ok, true);
    assert.equal(res1.designs.length, 1);
    assert.equal(res1.designs[0].name, "氣象啤牌");

    const second = createProject("custom", 16);
    second.settings.deckName = "自訂活動卡";
    const res2 = await saveDesignToBrowser(second);
    assert.equal(res2.designs.length, 2);

    first.settings.deckName = "氣象啤牌 v2";
    const updated = await saveDesignToBrowser(first, res1.entry.id);
    assert.equal(updated.designs.length, 2);
    assert.equal(
      updated.designs.find((item) => item.id === res1.entry.id).name,
      "氣象啤牌 v2",
    );

    const loaded = await loadSavedDesigns();
    assert.equal(loaded.length, 2);

    const afterDelete = await deleteSavedDesign(res1.entry.id);
    assert.equal(afterDelete.length, 1);
    assert.equal(afterDelete[0].name, "自訂活動卡");
  } finally {
    delete globalThis.localStorage;
  }
});
