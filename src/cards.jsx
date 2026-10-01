import React, { useId } from "react";
import {
  cardAsset,
  cardColor,
  cardLabel,
  cardSymbol,
  clamp,
  effectiveFront,
} from "./model.js";

const assetUrl = (name) => `${import.meta.env.BASE_URL}cards/${name}.svg`;

export function BackArtwork({ pattern = "classic", color = "#285c50" }) {
  const id = `back-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      className="back-artwork"
      viewBox="0 0 630 880"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={`${id}-diamond`}
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M12 1 23 12 12 23 1 12Z"
            fill="none"
            stroke="white"
            strokeWidth="1.3"
            opacity=".48"
          />
          <circle cx="12" cy="12" r="2" fill="white" opacity=".6" />
        </pattern>
        <pattern
          id={`${id}-lattice`}
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="m-7 7 28 28M7-7l28 28M-7 21 21-7M7 35l28-28"
            fill="none"
            stroke="white"
            strokeWidth="2"
            opacity=".45"
          />
          <path d="M14 8 20 14 14 20 8 14Z" fill="white" opacity=".5" />
        </pattern>
        <pattern
          id={`${id}-fine`}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="m8 1 7 7-7 7-7-7Z"
            fill="none"
            stroke="white"
            strokeWidth=".7"
            opacity=".28"
          />
        </pattern>
      </defs>
      <rect width="630" height="880" rx="27" fill="white" />
      <rect x="30" y="30" width="570" height="820" rx="16" fill={color} />
      {pattern !== "plain" && (
        <rect
          x="49"
          y="49"
          width="532"
          height="782"
          rx="9"
          fill={`url(#${id}-${pattern === "classic" ? "fine" : pattern === "diamond" ? "diamond" : "lattice"})`}
        />
      )}
      <rect
        x="43"
        y="43"
        width="544"
        height="794"
        rx="11"
        fill="none"
        stroke="white"
        strokeWidth="2"
      />
      <rect
        x="53"
        y="53"
        width="524"
        height="774"
        rx="7"
        fill="none"
        stroke="white"
        strokeWidth="1"
      />
      {pattern === "classic" && (
        <g fill="none" stroke="white">
          {[false, true].map((turned) => (
            <g
              key={String(turned)}
              transform={turned ? "translate(630 880) rotate(180)" : undefined}
            >
              <g transform="translate(315 247)">
                <ellipse rx="178" ry="166" strokeWidth="2" />
                <ellipse rx="169" ry="157" strokeWidth="1" />
                {Array.from({ length: 12 }, (_, index) => (
                  <g key={index} transform={`rotate(${index * 30})`}>
                    <ellipse cy="-77" rx="24" ry="69" strokeWidth="1.5" />
                    <path
                      d="M0-138Q-33-101 0-40Q33-101 0-138ZM0-135v94"
                      strokeWidth="1"
                    />
                    <circle cy="-153" r="3" fill="white" stroke="none" />
                  </g>
                ))}
                <circle r="41" strokeWidth="2" />
                <circle r="33" strokeWidth="1" />
                <path d="m0-25 25 25L0 25-25 0Z" strokeWidth="2" />
                <path d="m0-14 14 14L0 14-14 0Z" fill="white" stroke="none" />
              </g>
              <path
                d="M81 79q58-6 77 34M549 79q-58-6-77 34M81 366q21 52 87 61M549 366q-21 52-87 61"
                strokeWidth="3"
              />
              <path
                d="M78 91q22 9 21 29q-24-1-21-29Zm23 12q26 5 29 24q-25 5-29-24ZM552 91q-22 9-21 29q24-1 21-29Zm-23 12q-26 5-29 24q25 5 29-24Z"
                strokeWidth="1.4"
              />
              <path
                d="M176 425q50-35 139 3q89-38 139-3M185 434q45-20 130 5q85-25 130-5"
                strokeWidth="1.5"
              />
            </g>
          ))}
          <path d="m315 422 18 18-18 18-18-18Z" strokeWidth="2" />
          <circle cx="315" cy="440" r="5" fill="white" />
        </g>
      )}
      {pattern === "plain" && (
        <g fill="none" stroke="white" opacity=".75">
          <path d="m315 408 32 32-32 32-32-32Z" strokeWidth="2" />
          <path d="m315 422 18 18-18 18-18-18Z" strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}

function Corners({ card }) {
  const rank =
    card.kind === "poker"
      ? card.rank
      : card.kind === "joker"
        ? "JK"
        : card.number;
  return (
    <div
      className="corner-indices"
      style={{ color: cardColor(card) }}
      aria-hidden="true"
    >
      <div className="index top-index">
        <strong>{rank}</strong>
        <span>{cardSymbol(card)}</span>
      </div>
      <div className="index bottom-index">
        <strong>{rank}</strong>
        <span>{cardSymbol(card)}</span>
      </div>
    </div>
  );
}

function StandardFace({ card, hideCenter = false, overlayOnlyCenter = false }) {
  const asset = cardAsset(card);
  if (overlayOnlyCenter) {
    if (asset) {
      return (
        <img
          className="standard-face image-center-suit"
          data-testid="image-center-suit"
          src={assetUrl(asset)}
          alt=""
          draggable="false"
        />
      );
    }
    if (card.kind === "uno") {
      const display =
        { Skip: "⊘", Reverse: "⇄", WILD: "✦" }[card.rank] || card.rank;
      return (
        <strong
          className={`uno-value ${String(display).length > 2 ? "small-value" : ""}`}
          data-testid="image-center-suit"
        >
          {display}
        </strong>
      );
    }
    return (
      <span className="custom-number" data-testid="image-center-suit">
        {card.number}
      </span>
    );
  }

  if (asset) {
    if (hideCenter && card.kind === "joker") {
      return (
        <>
          <span className="standard-border" aria-hidden="true" />
          <span
            className="center-suit-mask"
            data-testid="center-suit-mask"
            aria-hidden="true"
          />
          <Corners card={card} />
        </>
      );
    }
    return (
      <>
        <img
          className="standard-face"
          src={assetUrl(asset)}
          alt=""
          draggable="false"
        />
        {hideCenter && (
          <span
            className="center-suit-mask"
            data-testid="center-suit-mask"
            aria-hidden="true"
          />
        )}
      </>
    );
  }
  if (card.kind === "uno") {
    const display =
      { Skip: "⊘", Reverse: "⇄", WILD: "✦" }[card.rank] || card.rank;
    return (
      <div className="uno-face" style={{ backgroundColor: card.color }}>
        <div className="uno-oval" />
        <span className="uno-index uno-top">{display}</span>
        {!hideCenter ? (
          <strong
            className={`uno-value ${String(display).length > 2 ? "small-value" : ""}`}
          >
            {display}
          </strong>
        ) : (
          <span
            className="center-suit-mask"
            data-testid="center-suit-mask"
            style={{ background: "transparent" }}
            aria-hidden="true"
          />
        )}
        <span className="uno-index uno-bottom">{display}</span>
      </div>
    );
  }
  return (
    <>
      <Corners card={card} />
      {!hideCenter ? (
        <span className="custom-number">{card.number}</span>
      ) : (
        <span
          className="center-suit-mask"
          data-testid="center-suit-mask"
          aria-hidden="true"
        />
      )}
    </>
  );
}

function Logo({ settings, back = false, replaceCenter = false }) {
  const pos = back
    ? "back-logo"
    : replaceCenter
      ? "logo-center logo-replace-center"
      : `logo-${settings.logoPosition}`;
  return (
    <div
      className={`card-logo ${pos}`}
      style={{ width: `${(clamp(settings.logoSize, 5, 45, 18) / 63) * 100}%` }}
    >
      {settings.logo ? (
        <img src={settings.logo} alt="" />
      ) : (
        <span className="logo-placeholder preview-only">LOGO</span>
      )}
    </div>
  );
}

export function PlayingCard({
  card,
  side = "front",
  settings,
  className = "",
}) {
  const front = effectiveFront(card, settings);
  const back = settings.back;
  const bodyLength =
    front.body.length + (front.body.match(/\n/g)?.length || 0) * 18;
  const userScale = clamp(front.textSize, 60, 220, 130) / 100;
  const bodySize =
    Math.min(0.052, Math.sqrt(0.38 / Math.max(bodyLength, 1))) * userScale;
  const baseTitleSize =
    front.title.length > 40
      ? 0.045
      : front.title.length > 20
        ? 0.058
        : front.title.length > 10
          ? 0.075
          : 0.095;
  const titleSize = baseTitleSize * userScale;
  const textShowsCenterSuit =
    Boolean(front.showCenterSuit) && !front.replaceCenter;

  return (
    <article
      className={`playing-card ${side === "back" ? "card-back" : `card-face mode-${front.mode}`} ${className}`}
      data-card-id={card.id}
      data-side={side}
      aria-label={`${cardLabel(card)} ${side === "back" ? "牌背" : "牌面"}`}
    >
      {side === "back" ? (
        <>
          {back.pattern === "upload" && back.art ? (
            <img
              className={`full-card-image fit-${back.fit} frame-${back.frame}`}
              src={back.art}
              alt=""
            />
          ) : (
            <BackArtwork
              pattern={back.pattern === "upload" ? "classic" : back.pattern}
              color={back.color}
            />
          )}
          {back.showLogo && <Logo settings={settings} back />}
          {back.text && (
            <>
              <div className="back-text back-text-top">{back.text}</div>
              <div className="back-text back-text-bottom">{back.text}</div>
            </>
          )}
        </>
      ) : (
        <>
          {front.mode === "pure" && <StandardFace card={card} />}
          {front.mode === "logo" && (
            <>
              <StandardFace
                card={card}
                hideCenter={Boolean(front.replaceCenter)}
              />
              <Logo
                settings={settings}
                replaceCenter={Boolean(front.replaceCenter)}
              />
            </>
          )}
          {front.mode === "image" && (
            <>
              {front.art ? (
                <img
                  className={`full-card-image fit-${front.fit} frame-${front.frame}`}
                  src={front.art}
                  alt=""
                />
              ) : (
                <>
                  <StandardFace
                    card={card}
                    hideCenter={!front.showCenterSuit}
                  />
                  <div className="image-placeholder preview-only">
                    <svg viewBox="0 0 40 40" aria-hidden="true">
                      <rect x="5" y="5" width="30" height="30" rx="4" />
                      <circle cx="14" cy="14" r="3" />
                      <path d="m6 29 10-9 7 6 5-5 7 8" />
                    </svg>
                    <span>上傳完整圖片</span>
                  </div>
                </>
              )}
              {front.art && front.showCenterSuit && (
                <StandardFace card={card} overlayOnlyCenter />
              )}
              {front.showIndices && <Corners card={card} />}
            </>
          )}
          {front.mode === "text" && (
            <>
              {textShowsCenterSuit ? (
                <StandardFace card={card} hideCenter={false} />
              ) : (
                <>
                  {front.replaceCenter && (
                    <StandardFace card={card} hideCenter={true} />
                  )}
                  {!front.replaceCenter && front.showIndices && (
                    <Corners card={card} />
                  )}
                </>
              )}
              <div
                className={`text-card-content ${textShowsCenterSuit ? "keep-center" : "replace-center"}`}
                style={{ "--body-size": bodySize, "--title-size": titleSize }}
              >
                <span className="text-card-rule" />
                {front.title && <h3>{front.title}</h3>}
                {front.body && <p>{front.body}</p>}
                {front.footer && <small>{front.footer}</small>}
              </div>
            </>
          )}
          {settings.copyright && (
            <div className="card-legal">{settings.copyright}</div>
          )}
        </>
      )}
    </article>
  );
}
