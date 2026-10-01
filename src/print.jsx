import React from "react";
import { PlayingCard } from "./cards.jsx";
import { cropMarks } from "./print-layout.js";

export function PrintPage({ page, layout, settings, sheets, preview = false }) {
  const back = page.side === "back";
  const offsetX = back ? settings.print.offsetX : 0;
  const offsetY = back ? settings.print.offsetY : 0;
  const paperStyle = {
    "--paper-width": preview
      ? "var(--preview-paper-width, 260px)"
      : `${layout.width}mm`,
    "--paper-height": preview
      ? `calc(var(--paper-width) * ${layout.height / layout.width})`
      : `${layout.height}mm`,
    "--card-width": `calc(var(--paper-width) * ${63 / layout.width})`,
    "--card-height": `calc(var(--paper-height) * ${88 / layout.height})`,
  };
  const gridStyle = {
    left: `${((layout.left + offsetX) / layout.width) * 100}%`,
    top: `${((layout.top + offsetY) / layout.height) * 100}%`,
    width: `${(layout.gridWidth / layout.width) * 100}%`,
    height: `${(layout.gridHeight / layout.height) * 100}%`,
    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
    gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
    columnGap: `${(layout.gap / layout.gridWidth) * 100}%`,
    rowGap: `${(layout.gap / layout.gridHeight) * 100}%`,
  };
  return (
    <div
      className={`print-page ${preview ? "paper-preview" : ""}`}
      style={paperStyle}
      data-sheet={page.sheet}
      data-side={page.side}
    >
      <div className="paper-grid" style={gridStyle}>
        {page.slots.map((card, index) => (
          <div
            className={`print-cell ${card ? "" : "empty-cell"} ${page.rotation ? "rotated-cell" : ""}`}
            key={index}
            data-slot={index}
            data-card-id={card?.id || ""}
          >
            {card && (
              <PlayingCard card={card} side={page.side} settings={settings} />
            )}
          </div>
        ))}
      </div>
      {settings.print.cutMarks && layout.count > 1 && (
        <svg
          className="crop-guides"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
        >
          {!back && (
            <g stroke="#747d77" strokeWidth=".14">
              {cropMarks(layout, page.slots).map((line, index) => (
                <line
                  key={index}
                  x1={line[0]}
                  y1={line[1]}
                  x2={line[2]}
                  y2={line[3]}
                />
              ))}
            </g>
          )}
          <g fill="#747d77" fontSize="2.1">
            <text x={layout.left} y="9">
              {settings.deckName.slice(0, 24)} · {page.sheet}/{sheets} ·{" "}
              {back ? "反面" : "正面"}
            </text>
            <text x={layout.width - layout.left} y="9" textAnchor="end">
              63 × 88 mm · 100%
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}

export function PrintOutput({ plan, settings, firstSheetOnly }) {
  const pages = firstSheetOnly ? plan.pages.slice(0, 2) : plan.pages;
  return (
    <section
      className="print-output"
      aria-hidden="true"
      data-testid="print-output"
    >
      {pages.map((page) => (
        <PrintPage
          key={`${page.sheet}-${page.side}`}
          page={page}
          layout={plan.layout}
          settings={settings}
          sheets={plan.sheets}
        />
      ))}
    </section>
  );
}
