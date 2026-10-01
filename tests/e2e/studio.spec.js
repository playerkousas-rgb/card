import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";
import { createProject } from "../../src/model.js";

const sampleImage = (name = "logo.svg", color = "#285c50") => ({
  name,
  mimeType: "image/svg+xml",
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="250" viewBox="0 0 180 250"><rect width="180" height="250" fill="${color}"/><circle cx="90" cy="125" r="55" fill="white"/></svg>`,
  ),
});
const printPages = (page) => page.locator(".print-output .print-page");
const nav = (page, name) => page.getByRole("button", { name, exact: true });

async function openStudio(page) {
  await page.goto("/");
  await expect(page.locator("#inspector-title")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function saved(page) {
  await expect(page.locator(".save-status")).toHaveClass(/saved/);
}

test("normal 52-card deck, real local artwork, functional navigation, and no Google Drive links", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openStudio(page);
  await expect(page.locator('a[href*="drive.google.com"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("drive.google.com");
  await expect(page.locator("body")).not.toContainText("參考素材");
  await expect(page.getByRole("option")).toHaveCount(52);
  await expect(page.locator(".card-pair .standard-face")).toHaveAttribute(
    "src",
    /cards\/Sa\.svg$/,
  );
  await expect(
    page.locator(".card-pair .card-back .back-artwork"),
  ).toBeVisible();
  await expect(page.locator(".card-pair .card-back")).not.toContainText(
    "我的啤牌",
  );
  await nav(page, "下一張牌").click();
  await expect(page.locator(".card-pair .standard-face")).toHaveAttribute(
    "src",
    /S2\.svg$/,
  );
  await nav(page, "紅心").click();
  await expect(page.getByRole("option")).toHaveCount(13);
  await expect(page.locator(".card-pair .standard-face")).toHaveAttribute(
    "src",
    /Ha\.svg$/,
  );
  await expect(printPages(page)).toHaveCount(12);
  expect(errors).toEqual([]);
});

test("individual text card offers option to replace or show center suit, stays isolated, and undo/redo work", async ({
  page,
}) => {
  await openStudio(page);
  await page.getByRole("option", { name: "2♠", exact: true }).click();
  await nav(page, "牌面").click();
  await nav(page, "只改 2♠").click();
  await page.getByRole("radio", { name: "加入文字", exact: true }).click();
  await page.getByLabel("標題", { exact: true }).fill("積雲");
  await page
    .getByLabel("內容", { exact: true })
    .fill("晴天常見的雲，像棉花一樣。");
  await expect(page.locator(".card-pair h3")).toHaveText("積雲");
  await nav(page, "取代正中間花色").click();
  await expect(
    page.locator(".card-pair .card-face [data-testid='center-suit-mask']"),
  ).toBeVisible();
  await expect(page.locator(".card-pair .card-face .standard-face")).toBeVisible();
  await nav(page, "顯示中間花色").click();
  await expect(
    page.locator(".card-pair .card-face [data-testid='center-suit-mask']"),
  ).toHaveCount(0);
  await expect(page.locator(".card-pair .card-face .standard-face")).toBeVisible();
  await expect(
    page.locator(".print-output .print-page").first().locator(".mode-text"),
  ).toHaveCount(1);
  await page.getByRole("option", { name: "3♠", exact: true }).click();
  await expect(page.locator(".card-pair .standard-face")).toHaveAttribute(
    "src",
    /S3\.svg$/,
  );
  await page.getByRole("option", { name: "2♠", exact: true }).click();
  await nav(page, "復原").click();
  await nav(page, "重做").click();
  await expect(page.getByLabel("內容", { exact: true })).toHaveValue(
    "晴天常見的雲，像棉花一樣。",
  );
});

test("small logo defaults to 18 mm keeping center suit, offers option to replace center suit at 24 mm, persists, and remains optional on backs", async ({
  page,
}) => {
  await openStudio(page);
  await nav(page, "牌面").click();
  await page.getByRole("radio", { name: "小 LOGO", exact: true }).click();
  await page.locator('input[data-upload="logo"]').setInputFiles(sampleImage());
  await expect(page.locator(".card-pair .card-logo img")).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/,
  );
  await expect(
    page.locator(".card-pair .card-face [data-testid='center-suit-mask']"),
  ).toHaveCount(0);
  const ratio = await page
    .locator(".card-pair .card-face")
    .evaluate(
      (card) =>
        card.querySelector(".card-logo").getBoundingClientRect().width /
        card.getBoundingClientRect().width,
    );
  expect(ratio).toBeCloseTo(18 / 63, 2);
  await nav(page, "取代正中間花色（占正中央）").click();
  await expect(
    page.locator(".card-pair .card-face [data-testid='center-suit-mask']"),
  ).toBeVisible();
  await expect(page.locator(".card-pair .card-face .card-logo")).toHaveClass(
    /logo-replace-center/,
  );
  await saved(page);
  await page.reload();
  await expect(page.locator(".card-pair .card-logo img")).toBeVisible();
  await nav(page, "牌背").click();
  await expect(page.locator(".card-pair .card-back .card-logo")).toHaveCount(0);
  await page.getByText("加入小 Logo 或文字", { exact: true }).click();
  await page.getByLabel("牌背加入小 Logo", { exact: false }).check();
  await expect(
    page.locator(".card-pair .card-back .card-logo img"),
  ).toBeVisible();
});

test("browser design storage saves, lists, switches, and deletes multiple user designs", async ({
  page,
}) => {
  await openStudio(page);
  await page.getByLabel("牌組名稱", { exact: true }).fill("第一款氣象牌");
  await nav(page, "存入瀏覽器").click();
  await expect(page.getByRole("alert")).toContainText("已存入瀏覽器");

  await page.getByLabel("牌組名稱", { exact: true }).fill("第二款童軍牌");
  await page.getByRole("button", { name: /我的設計/ }).click();
  const dialog = page.getByRole("dialog", { name: "瀏覽器儲存的設計" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "另存為新設計" }).click();
  await expect(dialog.locator(".dialog-design-card")).toHaveCount(2);

  const firstCard = dialog
    .locator(".dialog-design-card")
    .filter({ hasText: "第一款氣象牌" });
  await firstCard.getByRole("button", { name: "載入" }).click();
  await expect(page.getByLabel("牌組名稱", { exact: true })).toHaveValue(
    "第一款氣象牌",
  );

  await page.getByRole("button", { name: /我的設計/ }).click();
  await expect(dialog).toBeVisible();
  const secondCard = dialog
    .locator(".dialog-design-card")
    .filter({ hasText: "第二款童軍牌" });
  await secondCard.getByRole("button", { name: /刪除/ }).click();
  await expect(dialog.locator(".dialog-design-card")).toHaveCount(1);
  await dialog.getByRole("button", { name: "關閉" }).click();
});

test("A4 cards-per-sheet selector allows choosing arbitrary counts and 3R defaults to 2 cards", async ({
  page,
}) => {
  await openStudio(page);
  await expect(printPages(page)).toHaveCount(12); // 52 cards / 9 per sheet = 6 sheets = 12 pages
  await page.getByRole("button", { name: "4 張", exact: true }).click();
  await expect(printPages(page)).toHaveCount(26); // 52 cards / 4 per sheet = 13 sheets = 26 pages
  await page.getByLabel("每張 A4 印幾張牌", { exact: true }).fill("16");
  await expect(printPages(page)).toHaveCount(8); // 52 cards / 16 per sheet = 4 sheets = 8 pages
  await page.getByRole("button", { name: "9 張", exact: true }).click();
  await expect(printPages(page)).toHaveCount(12);

  await nav(page, "輸出").click();
  await page.getByRole("radio", { name: /3R 相片紙/ }).click();
  await expect(printPages(page)).toHaveCount(52); // 52 cards / 2 per 3R sheet = 26 sheets = 52 pages
});

test("complete images can be added in a batch without altering the next unedited card", async ({
  page,
}) => {
  await openStudio(page);
  await nav(page, "牌面").click();
  await nav(page, "只改 A♠").click();
  await page.getByRole("radio", { name: "完整圖片", exact: true }).click();
  await page
    .locator('input[data-upload="front"]')
    .setInputFiles([
      sampleImage("one.svg", "#cc3344"),
      sampleImage("two.svg", "#224477"),
    ]);
  await expect(
    page
      .locator(".print-output .print-page")
      .first()
      .locator(".full-card-image"),
  ).toHaveCount(2);
  const images = await page
    .locator(".print-output .print-page")
    .first()
    .locator(".full-card-image")
    .evaluateAll((nodes) => nodes.map((node) => node.src));
  expect(images[0]).not.toEqual(images[1]);
  await page.getByRole("option", { name: "3♠", exact: true }).click();
  await expect(page.locator(".card-pair .standard-face")).toHaveAttribute(
    "src",
    /S3\.svg$/,
  );
  await page.getByRole("option", { name: "A♠", exact: true }).click();
  await nav(page, "完整顯示").click();
  await expect(page.locator(".card-pair .full-card-image")).toHaveCSS(
    "object-fit",
    "contain",
  );
  await page.getByLabel("保留白邊", { exact: true }).check();
  await expect(page.locator(".card-pair .full-card-image")).toHaveClass(
    /frame-white/,
  );
  await expect(
    page.locator(".card-pair .card-face [data-testid='image-center-suit']"),
  ).toHaveCount(0);
  await nav(page, "顯示正中間花色（似啤牌）").click();
  await expect(
    page.locator(".card-pair .card-face [data-testid='image-center-suit']"),
  ).toBeVisible();
  await nav(page, "不顯示（不擋圖案）").click();
  await expect(
    page.locator(".card-pair .card-face [data-testid='image-center-suit']"),
  ).toHaveCount(0);
});

test("uploaded back image replaces the pattern, without duplicated logos or app branding", async ({
  page,
}) => {
  await openStudio(page);
  await nav(page, "牌背").click();
  await page
    .locator('input[data-upload="back"]')
    .setInputFiles(sampleImage("back.svg"));
  await expect(
    page.locator(".card-pair .card-back .full-card-image"),
  ).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(page.locator(".card-pair .card-back .back-artwork")).toHaveCount(
    0,
  );
  await expect(page.locator(".card-pair .card-back .card-logo")).toHaveCount(0);
  await page.getByRole("radio", { name: "菱格細紋", exact: true }).click();
  await expect(
    page.locator(".card-pair .card-back .back-artwork"),
  ).toBeVisible();
  await nav(page, "使用之前上傳的牌背").click();
  await expect(
    page.locator(".card-pair .card-back .full-card-image"),
  ).toBeVisible();
});

test("A4 PDF is 12 paired pages with fixed-size cards and a correctly padded final sheet", async ({
  page,
}) => {
  await openStudio(page);
  await nav(page, "輸出").click();
  await expect(printPages(page)).toHaveCount(12);
  const pages = await printPages(page).evaluateAll((nodes) =>
    nodes.map((node) => ({
      side: node.dataset.side,
      sheet: node.dataset.sheet,
      slots: Array.from(node.querySelectorAll(".print-cell")).map(
        (cell) => cell.dataset.cardId,
      ),
    })),
  );
  for (let index = 0; index < 12; index += 2) {
    expect(pages[index].side).toBe("front");
    expect(pages[index + 1].side).toBe("back");
    expect(pages[index].sheet).toBe(pages[index + 1].sheet);
    const mirrored = [2, 1, 0, 5, 4, 3, 8, 7, 6].map(
      (slot) => pages[index].slots[slot],
    );
    expect(pages[index + 1].slots).toEqual(mirrored);
  }
  expect(pages[10].slots.slice(-2)).toEqual(["", ""]);
  expect(pages[11].slots.slice(6, 8)).toEqual(["", ""]);
  await page.emulateMedia({ media: "print" });
  const card = await printPages(page)
    .first()
    .locator(".playing-card")
    .first()
    .boundingBox();
  expect((card.width * 25.4) / 96).toBeCloseTo(63, 1);
  expect((card.height * 25.4) / 96).toBeCloseTo(88, 1);
  await expect(page.locator(".app-shell")).toBeHidden();
  const bytes = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(12);
  expect(Math.abs(pdf.getPage(0).getWidth() - (210 * 72) / 25.4)).toBeLessThan(
    0.5,
  );
  expect(Math.abs(pdf.getPage(0).getHeight() - (297 * 72) / 25.4)).toBeLessThan(
    0.5,
  );
});

test("short-edge output mirrors rows, rotates backs and calibration changes only backs", async ({
  page,
}) => {
  await openStudio(page);
  await nav(page, "輸出").click();
  await nav(page, "短邊翻頁").click();
  const front = printPages(page).nth(0);
  const back = printPages(page).nth(1);
  const frontIds = await front
    .locator(".print-cell")
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.cardId));
  const backIds = await back
    .locator(".print-cell")
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.cardId));
  expect(backIds).toEqual(
    [6, 7, 8, 3, 4, 5, 0, 1, 2].map((index) => frontIds[index]),
  );
  await page.getByText("對位微調 / 手動雙面", { exact: true }).click();
  await page.getByLabel("牌背左右（mm）", { exact: true }).fill("1");
  await page.emulateMedia({ media: "print" });
  await expect(back.locator(".playing-card").first()).toHaveCSS(
    "transform",
    "matrix(-1, 0, 0, -1, 0, 0)",
  );
  const frontGrid = await front.locator(".paper-grid").boundingBox();
  const backGrid = await back.locator(".paper-grid").boundingBox();
  expect(((backGrid.x - frontGrid.x) * 25.4) / 96).toBeCloseTo(1, 1);
});

test("test print includes exactly one front/back pair and returns to the complete deck", async ({
  page,
}) => {
  await openStudio(page);
  await nav(page, "輸出").click();
  await page.evaluate(() => {
    window.print = () => {
      window.__printedPages = document.querySelectorAll(
        ".print-output .print-page",
      ).length;
    };
  });
  await nav(page, "先試印第 1 張紙（正＋反）").click();
  await expect.poll(() => page.evaluate(() => window.__printedPages)).toBe(2);
  await expect(printPages(page)).toHaveCount(2);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(printPages(page)).toHaveCount(12);
  await nav(page, "列印 / 存成 PDF").click();
  await expect.poll(() => page.evaluate(() => window.__printedPages)).toBe(12);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
});

test("all 108 UNO cards are selectable, including cards after the old 80-card limit", async ({
  page,
}) => {
  await openStudio(page);
  await page.getByRole("radio", { name: /UNO 類型/ }).click();
  await expect(page.getByRole("option")).toHaveCount(108);
  const last = page.getByRole("option").last();
  await last.click();
  await expect(last).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".card-pair .uno-value")).toHaveText("+4");
  await expect(printPages(page)).toHaveCount(24);
});

test("JSON backup contains images and re-imports cleanly; invalid files show a clear error", async ({
  page,
}) => {
  await openStudio(page);
  await page.getByLabel("牌組名稱", { exact: true }).fill("氣象組的啤牌");
  await nav(page, "牌面").click();
  await page.getByRole("radio", { name: "小 LOGO", exact: true }).click();
  await page.locator('input[data-upload="logo"]').setInputFiles(sampleImage());
  await expect(page.locator(".card-pair .card-logo img")).toBeVisible();
  await nav(page, "牌組").click();
  const downloadPromise = page.waitForEvent("download");
  await nav(page, "儲存設計").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-design\.json$/);
  const data = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  expect(data.settings.deckName).toBe("氣象組的啤牌");
  expect(data.version).toBe(2);
  expect(data.settings.logo).toMatch(/^data:image\/png;base64,/);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByLabel("牌組名稱", { exact: true }).fill("臨時名稱");
  await page.getByTestId("import-design").setInputFiles({
    name: "design.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.getByLabel("牌組名稱", { exact: true })).toHaveValue(
    "氣象組的啤牌",
  );
  await page.getByTestId("import-design").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{oops"),
  });
  await expect(page.getByRole("alert")).toContainText("檔案格式不正確");
});

test("3R photo output defaults to 2 real-size cards per sheet with paired pages", async ({
  page,
}) => {
  await openStudio(page);
  const project = createProject();
  project.cards = project.cards.slice(0, 2);
  project.settings.print.paper = "r3";
  project.settings.print.perSheet = 2;
  project.template = "custom";
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByTestId("import-design").setInputFiles({
    name: "photo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(printPages(page)).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  const card = await printPages(page)
    .first()
    .locator(".playing-card")
    .first()
    .boundingBox();
  expect((card.width * 25.4) / 96).toBeCloseTo(63, 1);
  expect((card.height * 25.4) / 96).toBeCloseTo(88, 1);
  const pdf = await PDFDocument.load(
    await page.pdf({ preferCSSPageSize: true, printBackground: true }),
  );
  expect(pdf.getPageCount()).toBe(2);
  expect(Math.abs(pdf.getPage(0).getWidth() - (127 * 72) / 25.4)).toBeLessThan(
    0.5,
  );
  expect(Math.abs(pdf.getPage(0).getHeight() - (89 * 72) / 25.4)).toBeLessThan(
    0.5,
  );
});

test("mobile and tablet layouts do not overflow and still expose usable controls", async ({
  page,
}) => {
  await openStudio(page);
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect(nav(page, "列印 / PDF")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, "牌面").click();
  await expect(page.locator("#inspector-title")).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "純啤牌", exact: true }),
  ).toBeVisible();
});

test("newer fallback storage wins over an older IndexedDB record, and migrates back successfully", async ({
  page,
}) => {
  await openStudio(page);
  await saved(page);
  const fallback = createProject();
  fallback.settings.deckName = "較新的離線備份";
  fallback.settings.print.perSheet = 6;
  await page.evaluate(
    (project) =>
      localStorage.setItem("card-studio:project:v2", JSON.stringify(project)),
    fallback,
  );
  await page.reload();
  await expect(page.getByLabel("牌組名稱", { exact: true })).toHaveValue(
    "較新的離線備份",
  );
  await expect(printPages(page)).toHaveCount(18);
  await saved(page);
  expect(
    await page.evaluate(() => localStorage.getItem("card-studio:project:v2")),
  ).toBeNull();
  await page.reload();
  await expect(page.getByLabel("牌組名稱", { exact: true })).toHaveValue(
    "較新的離線備份",
  );
});

test("blocked storage produces a real warning but still permits a JSON backup", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { get: () => undefined });
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "QuotaExceededError");
    };
  });
  await openStudio(page);
  await expect(page.locator(".save-status")).toHaveClass(/error/);
  await expect(page.getByRole("alert")).toContainText("未能自動儲存");
  const download = page.waitForEvent("download");
  await nav(page, "儲存設計").click();
  expect((await download).suggestedFilename()).toMatch(/-design\.json$/);
});

test("legacy localStorage data is migrated without losing suits", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "cards",
      JSON.stringify([
        {
          id: "old-one",
          number: "A♠",
          centerText: "A",
          note: "♠",
          title: "Spade",
          playColor: "black",
          playSuit: "",
          art: "",
        },
        {
          id: "old-two",
          number: "2♥",
          centerText: "2",
          note: "♥",
          title: "Heart",
          playColor: "red",
          playSuit: "",
          art: "",
        },
      ]),
    );
    localStorage.setItem("deckName", "原本的牌組");
    localStorage.setItem("printSize", "a4");
    localStorage.setItem("a4PerSheet", "9");
  });
  await openStudio(page);
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(page.getByLabel("牌組名稱", { exact: true })).toHaveValue(
    "原本的牌組",
  );
  await expect(page.locator(".card-pair .standard-face")).toHaveAttribute(
    "src",
    /Sa\.svg$/,
  );
  await page.getByRole("option", { name: "2♥", exact: true }).click();
  await expect(page.locator(".card-pair .standard-face")).toHaveAttribute(
    "src",
    /H2\.svg$/,
  );
  await expect(printPages(page)).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  const card = await printPages(page)
    .first()
    .locator(".playing-card")
    .first()
    .boundingBox();
  expect((card.width * 25.4) / 96).toBeCloseTo(63, 1);
});

test("radio groups and the deck can be operated with the keyboard", async ({
  page,
}) => {
  await openStudio(page);
  await nav(page, "牌面").click();
  const pure = page.getByRole("radio", { name: "純啤牌", exact: true });
  await pure.focus();
  await pure.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "小 LOGO", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("radio", { name: "小 LOGO", exact: true }),
  ).toBeFocused();
  await page.getByRole("radio", { name: "小 LOGO", exact: true }).press("Home");
  await expect(pure).toHaveAttribute("aria-checked", "true");
  const ace = page.getByRole("option", { name: "A♠", exact: true });
  await ace.focus();
  await ace.press("ArrowRight");
  const two = page.getByRole("option", { name: "2♠", exact: true });
  await expect(two).toHaveAttribute("aria-selected", "true");
  await expect(two).toBeFocused();
});

test("Scout System copyright is at the page bottom on desktop and mobile, not on printed cards", async ({
  page,
}) => {
  await openStudio(page);
  const footer = page.getByRole("contentinfo", { name: "網站版權" });
  await expect(footer).toHaveText("COPY RIGHT Scout System");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    const position = await page.evaluate(() => ({
      footerTop: document.querySelector(".app-footer").getBoundingClientRect()
        .top,
      mainBottom: document.querySelector(".workspace").getBoundingClientRect()
        .bottom,
      footerBottom:
        document.querySelector(".app-footer").getBoundingClientRect().bottom +
        scrollY,
      pageBottom: document.documentElement.scrollHeight,
      overflows: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(position.footerTop).toBeGreaterThanOrEqual(position.mainBottom - 1);
    expect(Math.abs(position.footerBottom - position.pageBottom)).toBeLessThan(
      1,
    );
    expect(position.overflows).toBe(false);
  }
  await page.emulateMedia({ media: "print" });
  await expect(footer).toBeHidden();
  await expect(page.locator(".print-output")).not.toContainText(
    "COPY RIGHT Scout System",
  );
  await expect(printPages(page)).toHaveCount(12);
});
