import { CARD_SIZE, MAX_CARDS, clamp } from "./model.js";

export const A4_CHOICES = [1, 2, 4, 6, 8, 9, 12, 16, 18, 20, 25, 36, 52];

export const PAPERS = {
  a4: { label: "A4 雙面列印", width: 210, height: 297 },
  r3: { label: "3R 相片紙", width: 127, height: 89 },
  r4: { label: "4R 相片紙", width: 152, height: 102 },
};

function fitGridLayout(paper, count, marginX, marginY, gap) {
  const usableW = paper.width - marginX * 2;
  const usableH = paper.height - marginY * 2;
  const aspect = CARD_SIZE.height / CARD_SIZE.width;
  let best = null;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const maxW = (usableW - (cols - 1) * gap) / cols;
    const maxH = (usableH - (rows - 1) * gap) / rows;
    if (maxW <= 0 || maxH <= 0) continue;
    const cardWidth = Math.min(CARD_SIZE.width, maxW, maxH / aspect);
    const cardHeight = cardWidth * aspect;
    const area = cardWidth * cardHeight;
    const waste = cols * rows - count;
    if (
      !best ||
      area > best.area + 0.01 ||
      (Math.abs(area - best.area) <= 0.01 && waste < best.waste)
    ) {
      best = {
        cols,
        rows,
        cardWidth: Number(cardWidth.toFixed(2)),
        cardHeight: Number(cardHeight.toFixed(2)),
        area,
        waste,
      };
    }
  }
  const { cols, rows, cardWidth, cardHeight } = best;
  const gridWidth = Number((cols * cardWidth + (cols - 1) * gap).toFixed(2));
  const gridHeight = Number((rows * cardHeight + (rows - 1) * gap).toFixed(2));
  return {
    ...paper,
    count,
    cols,
    rows,
    gap,
    cardWidth,
    cardHeight,
    gridWidth,
    gridHeight,
    left: Number(((paper.width - gridWidth) / 2).toFixed(2)),
    top: Number(((paper.height - gridHeight) / 2).toFixed(2)),
  };
}

export function printLayout(options = {}) {
  const paperKey = options.paper in PAPERS ? options.paper : "a4";
  const isA4 = paperKey === "a4";
  const defaultCount = isA4 ? 9 : 2;
  const rawCount = Number(options.perSheet);
  const count =
    Number.isFinite(rawCount) && rawCount >= 1
      ? Math.round(clamp(rawCount, 1, MAX_CARDS, defaultCount))
      : defaultCount;

  if (!isA4) {
    if (paperKey === "r3") {
      if (count === 1) {
        const paper = { label: PAPERS.r3.label, width: 89, height: 127 };
        return {
          ...paper,
          count: 1,
          cols: 1,
          rows: 1,
          gap: 0,
          cardWidth: CARD_SIZE.width,
          cardHeight: CARD_SIZE.height,
          gridWidth: CARD_SIZE.width,
          gridHeight: CARD_SIZE.height,
          left: (paper.width - CARD_SIZE.width) / 2,
          top: (paper.height - CARD_SIZE.height) / 2,
        };
      }
      if (count === 2) {
        const paper = PAPERS.r3;
        const gridWidth = CARD_SIZE.width * 2;
        const gridHeight = CARD_SIZE.height;
        return {
          ...paper,
          count: 2,
          cols: 2,
          rows: 1,
          gap: 0,
          cardWidth: CARD_SIZE.width,
          cardHeight: CARD_SIZE.height,
          gridWidth,
          gridHeight,
          left: (paper.width - gridWidth) / 2,
          top: (paper.height - gridHeight) / 2,
        };
      }
      return fitGridLayout(PAPERS.r3, count, 3, 3, 1);
    }
    if (count === 1) {
      const paper = { label: PAPERS.r4.label, width: 102, height: 152 };
      return {
        ...paper,
        count: 1,
        cols: 1,
        rows: 1,
        gap: 0,
        cardWidth: CARD_SIZE.width,
        cardHeight: CARD_SIZE.height,
        gridWidth: CARD_SIZE.width,
        gridHeight: CARD_SIZE.height,
        left: (paper.width - CARD_SIZE.width) / 2,
        top: (paper.height - CARD_SIZE.height) / 2,
      };
    }
    if (count === 2) {
      const paper = PAPERS.r4;
      const gap = 4;
      const gridWidth = CARD_SIZE.width * 2 + gap;
      const gridHeight = CARD_SIZE.height;
      return {
        ...paper,
        count: 2,
        cols: 2,
        rows: 1,
        gap,
        cardWidth: CARD_SIZE.width,
        cardHeight: CARD_SIZE.height,
        gridWidth,
        gridHeight,
        left: (paper.width - gridWidth) / 2,
        top: (paper.height - gridHeight) / 2,
      };
    }
    return fitGridLayout(PAPERS.r4, count, 4, 4, 1.5);
  }

  const paper = PAPERS.a4;
  if (count <= 9) {
    const cols =
      count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 1 : count <= 6 ? 2 : 3;
    const rows =
      count === 1 ? 1 : count === 2 ? 1 : count === 4 ? 2 : 3;
    const gap = count === 1 ? 0 : 2;
    const gridWidth = cols * CARD_SIZE.width + (cols - 1) * gap;
    const gridHeight = rows * CARD_SIZE.height + (rows - 1) * gap;
    return {
      ...paper,
      count,
      cols,
      rows,
      gap,
      cardWidth: CARD_SIZE.width,
      cardHeight: CARD_SIZE.height,
      gridWidth,
      gridHeight,
      left: (paper.width - gridWidth) / 2,
      top: (paper.height - gridHeight) / 2,
    };
  }

  const gap = count <= 16 ? 2 : count <= 36 ? 1.5 : 1;
  return fitGridLayout(paper, count, 8, 10, gap);
}

// Flip the positions, not the artwork. Null cells are deliberately retained on
// incomplete sheets, so the front and back of the last sheet still line up.
export function mirrorSlots(slots, layout, flip = "long") {
  const cells = layout.cols * layout.rows;
  const output = Array(cells).fill(null);
  slots.forEach((card, index) => {
    const row = Math.floor(index / layout.cols);
    const col = index % layout.cols;
    const nextRow = flip === "short" ? layout.rows - 1 - row : row;
    const nextCol = flip === "short" ? col : layout.cols - 1 - col;
    output[nextRow * layout.cols + nextCol] = card ?? null;
  });
  return output;
}

export function buildPrintPlan(cards, options = {}) {
  const layout = printLayout(options);
  const cells = layout.cols * layout.rows;
  const pages = [];
  for (let start = 0; start < cards.length; start += layout.count) {
    const sheet = Math.floor(start / layout.count) + 1;
    const front = Array.from(
      { length: cells },
      (_, index) =>
        index < layout.count ? cards[start + index] || null : null,
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
  const cw = layout.cardWidth || CARD_SIZE.width;
  const ch = layout.cardHeight || CARD_SIZE.height;
  slots.forEach((card, index) => {
    if (!card) return;
    const x = layout.left + (index % layout.cols) * (cw + layout.gap);
    const y =
      layout.top + Math.floor(index / layout.cols) * (ch + layout.gap);
    [0, cw].forEach((dx) => {
      [0, ch].forEach((dy) => {
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
