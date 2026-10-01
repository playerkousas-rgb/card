import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPrintPlan,
  cropMarks,
  mirrorSlots,
  printLayout,
} from "../src/print-layout.js";

const cards = (count) =>
  Array.from({ length: count }, (_, index) => ({ id: String(index + 1) }));
const ids = (slots) => slots.map((card) => card?.id ?? null);

for (const perSheet of [1, 2, 4, 6, 8, 9, 12, 16, 20, 36, 52]) {
  for (const count of [1, 6, 9, 10, 52, 54, 108, 160]) {
    for (const flip of ["long", "short"]) {
      test(`${count} cards / ${perSheet} per sheet / ${flip} edge: paired pages and exact alignment`, () => {
        const source = cards(count);
        const plan = buildPrintPlan(source, { paper: "a4", perSheet, flip });
        assert.equal(plan.pages.length, Math.ceil(count / perSheet) * 2);
        const gridCapacity = plan.layout.cols * plan.layout.rows;
        const printedFronts = [];
        for (let index = 0; index < plan.pages.length; index += 2) {
          const front = plan.pages[index];
          const back = plan.pages[index + 1];
          assert.equal(front.side, "front");
          assert.equal(back.side, "back");
          assert.equal(front.sheet, back.sheet);
          assert.equal(front.sheet, index / 2 + 1);
          assert.equal(front.slots.length, gridCapacity);
          assert.equal(back.slots.length, gridCapacity);
          assert.deepEqual(
            ids(mirrorSlots(back.slots, plan.layout, flip)),
            ids(front.slots),
          );
          assert.equal(back.rotation, flip === "short" ? 180 : 0);
          printedFronts.push(...front.slots.filter(Boolean));
        }
        assert.deepEqual(printedFronts, source);
      });
    }
  }
}

test("52-card last sheet keeps two blank cells, mirrored into the correct columns", () => {
  const plan = buildPrintPlan(cards(52), { perSheet: 9, flip: "long" });
  assert.equal(plan.sheets, 6);
  assert.deepEqual(ids(plan.pages[10].slots), [
    "46",
    "47",
    "48",
    "49",
    "50",
    "51",
    "52",
    null,
    null,
  ]);
  assert.deepEqual(ids(plan.pages[11].slots), [
    "48",
    "47",
    "46",
    "51",
    "50",
    "49",
    null,
    null,
    "52",
  ]);
});

test("short-edge positions mirror rows, never the artwork itself", () => {
  const plan = buildPrintPlan(cards(7), { perSheet: 9, flip: "short" });
  assert.deepEqual(ids(plan.pages[1].slots), [
    "7",
    null,
    null,
    "4",
    "5",
    "6",
    "1",
    "2",
    "3",
  ]);
  assert.equal(plan.pages[1].rotation, 180);
});

test("A4 uses centered fixed-size 63 × 88 mm cards for 1..9 per sheet and scales proportionally above 9", () => {
  const nine = printLayout({ perSheet: 9 });
  assert.deepEqual(
    [
      nine.width,
      nine.height,
      nine.cols,
      nine.rows,
      nine.cardWidth,
      nine.cardHeight,
      nine.gridWidth,
      nine.gridHeight,
      nine.left,
      nine.top,
    ],
    [210, 297, 3, 3, 63, 88, 193, 268, 8.5, 14.5],
  );
  const six = printLayout({ perSheet: 6 });
  assert.deepEqual(
    [six.cols, six.rows, six.gridWidth, six.gridHeight, six.left, six.top],
    [2, 3, 128, 268, 41, 14.5],
  );
  const sixteen = printLayout({ perSheet: 16 });
  assert.equal(sixteen.count, 16);
  assert.equal(sixteen.cols, 4);
  assert.equal(sixteen.rows, 4);
  assert.ok(sixteen.cardWidth > 0 && sixteen.cardWidth < 63);
  assert.ok(sixteen.gridWidth <= 210);
  assert.ok(sixteen.gridHeight <= 297);
});

test("invalid A4 counts fall back to 9 while valid counts 1..160 are respected", () => {
  for (const perSheet of [0, -1, NaN, Infinity, "bad"])
    assert.equal(printLayout({ perSheet }).count, 9);
  assert.equal(printLayout({ perSheet: 52 }).count, 52);
  assert.equal(printLayout({ perSheet: 999 }).count, 160);
});

test("3R photo paper defaults to 2 normal-sized cards (63 × 88 mm) per sheet, and supports 1 card", () => {
  const r3 = buildPrintPlan(cards(2), { paper: "r3" });
  assert.equal(r3.layout.count, 2);
  assert.equal(r3.pages.length, 2);
  assert.deepEqual(
    [
      r3.layout.width,
      r3.layout.height,
      r3.layout.cols,
      r3.layout.rows,
      r3.layout.cardWidth,
      r3.layout.cardHeight,
    ],
    [127, 89, 2, 1, 63, 88],
  );
  const r3Single = printLayout({ paper: "r3", perSheet: 1 });
  assert.deepEqual(
    [r3Single.width, r3Single.height, r3Single.cols, r3Single.rows, r3Single.left, r3Single.top],
    [89, 127, 1, 1, 13, 19.5],
  );
  const r4 = printLayout({ paper: "r4" });
  assert.deepEqual(
    [r4.width, r4.height, r4.cols, r4.rows, r4.cardWidth, r4.cardHeight],
    [152, 102, 2, 1, 63, 88],
  );
});

test("cut marks are outside occupied cards, never added to blank slots", () => {
  const plan = buildPrintPlan(cards(7), { perSheet: 9 });
  const marks = cropMarks(plan.layout, plan.pages[0].slots);
  assert.equal(marks.length, 7 * 8);
  for (const [x1, y1, x2, y2] of marks) {
    assert.ok(Math.min(x1, x2) >= 7);
    assert.ok(Math.max(x1, x2) <= 203);
    assert.ok(Math.min(y1, y2) >= 13);
    assert.ok(Math.max(y1, y2) <= 284);
  }
});
