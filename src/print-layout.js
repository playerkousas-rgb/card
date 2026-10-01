import { CARD_SIZE } from "./model.js";

export const PAPERS = {
  a4: { label: "A4 雙面列印", width: 210, height: 297 },
  r3: { label: "3R 相片紙", width: 89, height: 127 },
  r4: { label: "4R 相片紙", width: 102, height: 152 },
};

export function printLayout(options = {}) {
  const paper = PAPERS[options.paper] || PAPERS.a4;
  const isA4 = paper === PAPERS.a4;
  const count = isA4 ? (Number(options.perSheet) === 6 ? 6 : 9) : 1;
  const cols = count === 9 ? 3 : count === 6 ? 2 : 1;
  const rows = count === 1 ? 1 : 3;
  const gap = count === 1 ? 0 : 2;
  const gridWidth = cols * CARD_SIZE.width + (cols - 1) * gap;
  const gridHeight = rows * CARD_SIZE.height + (rows - 1) * gap;
  return {
    ...paper,
    count,
    cols,
    rows,
    gap,
    gridWidth,
    gridHeight,
    left: (paper.width - gridWidth) / 2,
    top: (paper.height - gridHeight) / 2,
  };
}

// Flip the positions, not the artwork. Null cells are deliberately retained on
// incomplete sheets, so the front and back of the last sheet still line up.
export function mirrorSlots(slots, layout, flip = "long") {
  const output = Array(layout.count).fill(null);
  slots.forEach((card, index) => {
    const row = Math.floor(index / layout.cols);
    const col = index % layout.cols;
    const nextRow = flip === "short" ? layout.rows - 1 - row : row;
    const nextCol = flip === "short" ? col : layout.cols - 1 - col;
    output[nextRow * layout.cols + nextCol] = card;
  });
  return output;
}

export function buildPrintPlan(cards, options = {}) {
  const layout = printLayout(options);
  const pages = [];
  for (let start = 0; start < cards.length; start += layout.count) {
    const sheet = start / layout.count + 1;
    const front = Array.from(
      { length: layout.count },
      (_, index) => cards[start + index] || null,
    );
    pages.push({ sheet, side: "front", slots: front, rotation: 0 });
    pages.push({
      sheet,
      side: "back",
      slots: mirrorSlots(front, layout, options.flip),
      rotation: options.flip === "short" ? 180 : 0,
    });
  }
  return { layout, pages, sheets: Math.ceil(cards.length / layout.count) };
}

export function cropMarks(layout, slots) {
  const lines = [];
  const outside = 0.3;
  const length = 1.2;
  slots.forEach((card, index) => {
    if (!card) return;
    const x =
      layout.left + (index % layout.cols) * (CARD_SIZE.width + layout.gap);
    const y =
      layout.top +
      Math.floor(index / layout.cols) * (CARD_SIZE.height + layout.gap);
    [0, CARD_SIZE.width].forEach((dx) => {
      [0, CARD_SIZE.height].forEach((dy) => {
        const px = x + dx;
        const py = y + dy;
        const sx = dx === 0 ? -1 : 1;
        const sy = dy === 0 ? -1 : 1;
        lines.push([px + sx * outside, py, px + sx * (outside + length), py]);
        lines.push([px, py + sy * outside, px, py + sy * (outside + length)]);
      });
    });
  });
  return lines;
}
