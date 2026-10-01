import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  CreditCard,
  Expand,
  ExternalLink,
  FileUp,
  FlipHorizontal2,
  FolderHeart,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Minus,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import "@fontsource-variable/noto-sans-tc";
import "./styles.css";
import {
  BACK_COLORS,
  BACK_PATTERNS,
  FRONT_MODES,
  MAX_CARDS,
  RANKS,
  SUITS,
  TEMPLATES,
  applyFrontPatch,
  cardLabel,
  clamp,
  createProject,
  effectiveFront,
  makeCustomCards,
  makeDeck,
  normalizeProject,
} from "./model.js";
import { BackArtwork, PlayingCard } from "./cards.jsx";
import { A4_CHOICES, buildPrintPlan, PAPERS } from "./print-layout.js";
import { PrintOutput, PrintPage } from "./print.jsx";
import {
  deleteSavedDesign,
  downloadProject,
  loadProject,
  loadSavedDesigns,
  saveDesignToBrowser,
  saveProject,
} from "./storage.js";
import { readImage } from "./images.js";
import { useProjectHistory } from "./use-history.js";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
const STEPS = [
  {
    id: "deck",
    label: "牌組",
    heading: "先選一副牌",
    subtitle: "經典啤牌，或者自己的玩法。",
    icon: Layers3,
  },
  {
    id: "front",
    label: "牌面",
    heading: "加一點你的心思",
    subtitle: "純牌、Logo、圖片或純文字，直接選。",
    icon: CreditCard,
  },
  {
    id: "back",
    label: "牌背",
    heading: "選一款好看的牌背",
    subtitle: "對稱花紋，全副牌共用。",
    icon: FlipHorizontal2,
  },
  {
    id: "print",
    label: "輸出",
    heading: "準備好，雙面列印",
    subtitle: "自選每張紙印幾張牌，正反面自動配對。",
    icon: Printer,
  },
];

function radioKeys(event) {
  if (
    ![
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ].includes(event.key)
  )
    return;
  const options = Array.from(
    event.currentTarget.querySelectorAll('button[role="radio"]'),
  );
  const current = options.indexOf(document.activeElement);
  if (current < 0 || !options.length) return;
  event.preventDefault();
  const index =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : (current +
            (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) +
            options.length) %
          options.length;
  options[index].focus();
  options[index].click();
}

function IconButton({ label, children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
function Field({ label, hint, children, className = "" }) {
  const id = React.useId();
  const controlId = children.props.id || id;
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={controlId}>
        {label}
      </label>
      {React.cloneElement(children, {
        id: controlId,
        "aria-describedby": hint ? `${id}-hint` : undefined,
      })}
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}
function Toggle({ label, checked, onChange, hint }) {
  return (
    <label className="toggle-field">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}
function Segmented({ label, options, value, onChange, className = "" }) {
  return (
    <div className={`segmented ${className}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          className={value === option.id ? "selected" : ""}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
function UploadZone({
  label,
  hint,
  value,
  onUpload,
  onRemove,
  busy,
  target,
  multiple = false,
}) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const id = React.useId();
  return (
    <div
      className={`upload-zone ${dragging ? "dragging" : ""} ${value ? "has-image" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!busy && event.dataTransfer.files.length)
          onUpload(Array.from(event.dataTransfer.files));
      }}
    >
      <label
        htmlFor={id}
        className="upload-trigger"
        tabIndex={busy ? -1 : 0}
        role="button"
        aria-label={label}
        aria-disabled={busy}
        onKeyDown={(event) => {
          if (!busy && ["Enter", " "].includes(event.key)) {
            event.preventDefault();
            input.current?.click();
          }
        }}
      >
        {value ? (
          <img src={value} className="upload-thumbnail" alt="已上傳的圖片" />
        ) : (
          <span className="upload-icon">
            <Upload size={21} strokeWidth={1.7} />
          </span>
        )}
        <span className="upload-copy">
          <strong>{busy ? "正在處理圖片…" : value ? "更換圖片" : label}</strong>
          <small>
            {value ? "已加入 · 按一下更換" : hint || "拖放圖片，或按一下上傳"}
          </small>
        </span>
        <input
          ref={input}
          id={id}
          hidden
          type="file"
          accept={IMAGE_ACCEPT}
          multiple={multiple}
          data-upload={target}
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length) onUpload(files);
          }}
        />
      </label>
      {value && onRemove && (
        <IconButton
          className="upload-remove"
          label="移除圖片"
          onClick={onRemove}
        >
          <X size={15} />
        </IconButton>
      )}
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
      <span>
        <strong>
          啤牌工房<span className="brand-dot">.</span>
        </strong>
        <small>CARD STUDIO</small>
      </span>
    </div>
  );
}

function formatSavedTime(timestamp) {
  try {
    return new Intl.DateTimeFormat("zh-HK", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function App() {
  const { project, change, replace, undo, redo, canUndo, canRedo } =
    useProjectHistory(createProject);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("deck");
  const [view, setView] = useState("cards");
  const [activeId, setActiveId] = useState(null);
  const [scope, setScope] = useState("deck");
  const [customCount, setCustomCount] = useState(12);
  const [suitFilter, setSuitFilter] = useState("all");
  const [sheetIndex, setSheetIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [storageStatus, setStorageStatus] = useState("saving");
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [activeDesignId, setActiveDesignId] = useState(null);
  const [designsOpen, setDesignsOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [firstSheetOnly, setFirstSheetOnly] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const stageRef = useRef(null);
  const deckRef = useRef(null);
  const autoFit = useRef(true);
  const [stageSize, setStageSize] = useState({ width: 800, height: 450 });

  const { settings, cards } = project;
  const activeCard = cards.find((card) => card.id === activeId) || cards[0];
  const activeIndex = cards.findIndex((card) => card.id === activeCard.id);
  const front =
    scope === "deck" ? settings.front : effectiveFront(activeCard, settings);
  const filteredCards = useMemo(
    () =>
      cards.filter(
        (card) =>
          suitFilter === "all" ||
          (suitFilter === "joker"
            ? card.kind === "joker"
            : card.suit === suitFilter),
      ),
    [cards, suitFilter],
  );
  const plan = useMemo(
    () => buildPrintPlan(cards, settings.print),
    [cards, settings.print],
  );
  const step = STEPS.find((item) => item.id === tab);
  const currentSheet = Math.min(sheetIndex, plan.sheets - 1);
  const notify = useCallback(
    (message, tone = "success") => setNotice({ message, tone }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadProject(), loadSavedDesigns()]).then(
      ([saved, designs]) => {
        if (cancelled) return;
        replace(saved);
        setSavedDesigns(designs);
        setActiveId(saved.cards[0].id);
        setCustomCount(saved.template === "custom" ? saved.cards.length : 12);
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [replace]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setStorageStatus("saving");
    const timer = setTimeout(
      () =>
        saveProject(project)
          .then(() => {
            if (!cancelled) setStorageStatus("saved");
          })
          .catch(() => {
            if (!cancelled) {
              setStorageStatus("error");
              notify("瀏覽器未能自動儲存，請按「儲存設計」下載備份。", "error");
            }
          }),
      450,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [project, ready, notify]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      saveProject(project).catch(() => {});
    };
    const hidden = () => {
      if (document.hidden) flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [project, ready]);

  useEffect(() => {
    document.title = `${settings.deckName}｜啤牌工房`;
  }, [settings.deckName]);
  useEffect(() => {
    if (!cards.some((card) => card.id === activeId)) setActiveId(cards[0].id);
    if (suitFilter !== "all" && !filteredCards.length) setSuitFilter("all");
  }, [cards, activeId, suitFilter, filteredCards.length]);
  useEffect(() => {
    if (!notice || notice.tone === "error") return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleSaveToBrowser = useCallback(
    async (asNew = false) => {
      try {
        const { entry, designs } = await saveDesignToBrowser(
          project,
          asNew ? null : activeDesignId,
        );
        setSavedDesigns(designs);
        setActiveDesignId(entry.id);
        notify(`已將「${entry.name}」儲存在瀏覽器設計庫。`);
      } catch {
        notify("瀏覽器空間不足，請用「儲存設計」下載 JSON 備份。", "error");
      }
    },
    [project, activeDesignId, notify],
  );

  const handleLoadFromBrowser = useCallback(
    (entry) => {
      try {
        const loaded = normalizeProject(entry.project, { requireCards: true });
        change(loaded);
        setActiveDesignId(entry.id);
        setActiveId(loaded.cards[0].id);
        setSuitFilter("all");
        setSheetIndex(0);
        setCustomCount(loaded.template === "custom" ? loaded.cards.length : 12);
        setDesignsOpen(false);
        notify(`已從瀏覽器載入「${entry.name}」。`);
      } catch {
        notify("未能載入此設計。", "error");
      }
    },
    [change, notify],
  );

  const handleDeleteFromBrowser = useCallback(
    async (entry) => {
      try {
        const next = await deleteSavedDesign(entry.id);
        setSavedDesigns(next);
        if (activeDesignId === entry.id) setActiveDesignId(null);
        notify(`已從瀏覽器移除「${entry.name}」。`);
      } catch {
        notify("未能刪除設計。", "error");
      }
    },
    [activeDesignId, notify],
  );

  useEffect(() => {
    const handler = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDesignToBrowser(project, activeDesignId)
          .then(({ entry, designs }) => {
            setSavedDesigns(designs);
            setActiveDesignId(entry.id);
          })
          .catch(() => {});
        downloadProject(project);
        notify("設計已存入瀏覽器並下載備份檔。");
      }
      if (
        event.target instanceof HTMLElement &&
        (event.target.matches("input, textarea, select") ||
          event.target.isContentEditable)
      )
        return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [project, activeDesignId, undo, redo, notify]);
  useEffect(() => {
    const handler = () => {
      setPrinting(false);
      setFirstSheetOnly(false);
    };
    window.addEventListener("afterprint", handler);
    return () => window.removeEventListener("afterprint", handler);
  }, []);
  useEffect(() => {
    if (!ready || !stageRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [ready]);

  const fitZoom = useCallback(() => {
    const width = view === "cards" ? 238 : 260;
    const height =
      view === "cards"
        ? 333
        : Math.round(260 * (plan.layout.height / plan.layout.width));
    const pair = stageRef.current?.querySelector(
      view === "cards" ? ".card-pair" : ".sheet-pair",
    );
    const gap = pair ? parseFloat(getComputedStyle(pair).gap) || 36 : 36;
    // ResizeObserver gives the content box (padding is already excluded).
    return Math.round(
      clamp(
        Math.min(
          (stageSize.width - gap) / (width * 2),
          (stageSize.height - 57) / height,
        ) * 100,
        45,
        125,
        100,
      ),
    );
  }, [view, stageSize, plan.layout.height, plan.layout.width]);
  useEffect(() => {
    if (autoFit.current) setZoom(fitZoom());
  }, [fitZoom]);
  useEffect(() => {
    const selected = deckRef.current?.querySelector(`[data-active="true"]`);
    if (selected) {
      const list = deckRef.current;
      if (list.contains(document.activeElement))
        selected.focus({ preventScroll: true });
      const left = selected.offsetLeft - list.offsetLeft;
      if (
        left < list.scrollLeft ||
        left + selected.offsetWidth > list.scrollLeft + list.clientWidth
      )
        list.scrollTo({
          left: Math.max(
            0,
            left - list.clientWidth / 2 + selected.offsetWidth / 2,
          ),
          behavior: "smooth",
        });
    }
  }, [activeId, suitFilter]);

  const patchSettings = (patch) =>
    change((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  const patchBack = (patch) =>
    change((current) => ({
      ...current,
      settings: {
        ...current.settings,
        back: { ...current.settings.back, ...patch },
      },
    }));
  const patchPrint = (patch) =>
    change((current) => ({
      ...current,
      settings: {
        ...current.settings,
        print: { ...current.settings.print, ...patch },
      },
    }));
  const changePaper = (nextPaper) => {
    const defaultPerSheet = nextPaper === "a4" ? 9 : 2;
    patchPrint({ paper: nextPaper, perSheet: defaultPerSheet });
    setSheetIndex(0);
  };
  const patchFront = (patch) =>
    change((current) => applyFrontPatch(current, patch, scope, activeCard.id));
  const patchCard = (patch) =>
    change((current) => ({
      ...current,
      cards: current.cards.map((card) =>
        card.id === activeCard.id ? { ...card, ...patch } : card,
      ),
    }));
  const chooseView = (next) => {
    autoFit.current = true;
    setView(next);
  };
  const chooseTab = (next) => {
    setTab(next);
    chooseView(next === "print" ? "sheets" : "cards");
    if (window.innerWidth <= 780)
      requestAnimationFrame(() =>
        document
          .querySelector(".inspector")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
  };

  const applyTemplate = (nextTemplate, count = customCount) => {
    const modified = cards.some((card) => Object.keys(card.front).length > 0);
    if (
      modified &&
      !window.confirm(
        "更換牌組會重新建立卡牌及清除逐張內容。共用 Logo、圖片及牌背設定會保留。是否繼續？",
      )
    )
      return;
    const next = makeDeck(nextTemplate, count);
    change((current) => ({ ...current, template: nextTemplate, cards: next }));
    setActiveId(next[0].id);
    setSuitFilter("all");
    setSheetIndex(0);
    if (nextTemplate === "custom") setCustomCount(next.length);
  };
  const addCard = () => {
    if (cards.length >= MAX_CARDS) {
      notify("每副牌最多 160 張。", "error");
      return;
    }
    const card = makeCustomCards(1)[0];
    card.number = String(cards.length + 1).padStart(2, "0");
    card.front.title = `卡牌 ${cards.length + 1}`;
    change((current) => ({ ...current, cards: [...current.cards, card] }));
    setActiveId(card.id);
    setSuitFilter("all");
    setScope("card");
    chooseTab("front");
    chooseView("cards");
  };
  const duplicateCard = () => {
    if (cards.length >= MAX_CARDS) {
      notify("每副牌最多 160 張。", "error");
      return;
    }
    const copy = {
      ...activeCard,
      id: crypto.randomUUID(),
      front: { ...activeCard.front },
    };
    change((current) => {
      const next = [...current.cards];
      next.splice(activeIndex + 1, 0, copy);
      return { ...current, cards: next };
    });
    setActiveId(copy.id);
    notify(`已複製 ${cardLabel(activeCard)}。`);
  };
  const removeCard = () => {
    if (
      cards.length <= 1 ||
      !window.confirm(`刪除 ${cardLabel(activeCard)}？可以用「復原」還原。`)
    )
      return;
    const next = cards.filter((card) => card.id !== activeCard.id);
    change((current) => ({ ...current, cards: next }));
    setActiveId(next[Math.min(activeIndex, next.length - 1)].id);
  };
  const navigateCard = (direction) => {
    const list = filteredCards.length ? filteredCards : cards;
    const index = list.findIndex((card) => card.id === activeCard.id);
    setActiveId(list[(index + direction + list.length) % list.length].id);
  };

  const uploadImages = async (files, target) => {
    if (busy) return;
    const targetCardId = activeCard.id;
    const targetScope = scope;
    const startIndex = activeIndex;
    const allowed =
      target === "front" && targetScope === "card"
        ? cards.length - startIndex
        : 1;
    const selected = files.slice(0, allowed);
    setBusy(true);
    try {
      const images = [];
      for (const file of selected) images.push(await readImage(file));
      change((current) => {
        if (target === "logo")
          return {
            ...current,
            settings: { ...current.settings, logo: images[0] },
          };
        if (target === "back")
          return {
            ...current,
            settings: {
              ...current.settings,
              back: {
                ...current.settings.back,
                art: images[0],
                pattern: "upload",
              },
            },
          };
        if (targetScope === "deck")
          return applyFrontPatch(
            current,
            { art: images[0], mode: "image" },
            "deck",
            targetCardId,
          );
        // Resolve by IDs captured at upload time so selecting another card while
        // an image decodes cannot attach that image to the wrong card.
        const ids = cards
          .slice(startIndex, startIndex + images.length)
          .map((card) => card.id);
        return {
          ...current,
          cards: current.cards.map((card) => {
            const index = ids.indexOf(card.id);
            return index < 0
              ? card
              : {
                  ...card,
                  front: { ...card.front, mode: "image", art: images[index] },
                };
          }),
        };
      });
      notify(
        images.length > 1
          ? `已順序加入 ${images.length} 張圖片${files.length > allowed ? "，超出牌組的圖片未加入" : ""}。`
          : "圖片已加入。",
      );
    } catch (error) {
      notify(error.message || "未能加入圖片，請重試。", "error");
    } finally {
      setBusy(false);
    }
  };
  const importDesign = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 256 * 1024 * 1024)
        throw new Error("設計檔上限為 256 MB。");
      const saved = normalizeProject(JSON.parse(await file.text()), {
        requireCards: true,
      });
      if (
        !window.confirm(
          "載入設計會取代目前的牌組。建議先儲存設計備份。是否繼續？",
        )
      )
        return;
      change(saved);
      setActiveId(saved.cards[0].id);
      setSuitFilter("all");
      setSheetIndex(0);
      setCustomCount(saved.template === "custom" ? saved.cards.length : 12);
      setDesignsOpen(false);
      notify("設計已載入。");
    } catch (error) {
      notify(
        error instanceof SyntaxError
          ? "檔案格式不正確，請選擇卡牌設計 JSON。"
          : error.message,
        "error",
      );
    }
  };
  const preparePrint = async (firstOnly) => {
    if (busy || printing) return;
    setPrinting(true);
    setFirstSheetOnly(firstOnly);
    try {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      await document.fonts.ready;
      const images = Array.from(document.querySelectorAll(".print-output img"));
      await Promise.all(images.map((image) => image.decode()));
      window.print();
    } catch {
      setPrinting(false);
      setFirstSheetOnly(false);
      notify("部分圖片未能載入，暫未開啟列印。請稍後再試。", "error");
    }
  };

  if (!ready)
    return (
      <div className="loading-screen">
        <Brand />
        <LoaderCircle className="spin" size={24} />
        <p>正在載入你的牌組…</p>
      </div>
    );

  return (
    <>
      <style>{`@page { size: ${plan.layout.width}mm ${plan.layout.height}mm; margin: 0; }`}</style>
      <div className="app-shell">
        <header className="app-header">
          <Brand />
          <div className={`save-status ${storageStatus}`}>
            <span className="status-dot" />
            {storageStatus === "saved"
              ? "已儲存在此瀏覽器"
              : storageStatus === "error"
                ? "請下載備份"
                : "儲存中…"}
          </div>
          <div className="header-actions">
            <button
              className="button quiet"
              onClick={() => setDesignsOpen(true)}
            >
              <FolderHeart size={17} />
              <span>
                我的設計
                {savedDesigns.length > 0 ? ` (${savedDesigns.length})` : ""}
              </span>
            </button>
            <button
              className="button quiet"
              onClick={() => handleSaveToBrowser(true)}
            >
              <BookmarkPlus size={17} />
              <span>存入瀏覽器</span>
            </button>
            <label className="button quiet load-design">
              <FileUp size={17} />
              <span>載入設計</span>
              <input
                hidden
                type="file"
                accept="application/json,.json"
                data-testid="import-design"
                disabled={busy || printing}
                onChange={importDesign}
              />
            </label>
            <button
              className="button quiet"
              onClick={() => {
                saveDesignToBrowser(project, activeDesignId)
                  .then(({ entry, designs }) => {
                    setSavedDesigns(designs);
                    setActiveDesignId(entry.id);
                  })
                  .catch(() => {});
                downloadProject(project);
                notify("設計已存入瀏覽器並下載備份檔。");
              }}
            >
              <ArrowDownToLine size={17} />
              <span>儲存設計</span>
            </button>
            <span className="header-divider" />
            <button
              className="button primary"
              onClick={() => chooseTab("print")}
            >
              <Printer size={17} />
              <span>列印 / PDF</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </header>

        <main className="workspace">
          <nav className="tool-rail" aria-label="製作步驟">
            <div className="rail-tools">
              {STEPS.map((item, index) => (
                <button
                  key={item.id}
                  className={`rail-tool ${tab === item.id ? "active" : ""}`}
                  aria-current={tab === item.id ? "step" : undefined}
                  aria-label={item.label}
                  onClick={() => chooseTab(item.id)}
                >
                  <span className="rail-icon">
                    <item.icon size={21} strokeWidth={1.7} />
                  </span>
                  <span>{item.label}</span>
                  <small>0{index + 1}</small>
                </button>
              ))}
            </div>
            <IconButton label="快速使用說明" onClick={() => setHelpOpen(true)}>
              <CircleHelp size={21} strokeWidth={1.6} />
            </IconButton>
          </nav>

          <aside className="inspector" aria-labelledby="inspector-title">
            <div className="inspector-heading">
              <div className="step-eyebrow">
                STEP 0{STEPS.findIndex((item) => item.id === tab) + 1}
                <span> / 04</span>
              </div>
              <h1 id="inspector-title">{step.heading}</h1>
              <p>{step.subtitle}</p>
            </div>
            <fieldset
              className="inspector-body"
              disabled={busy || printing}
              aria-busy={busy}
            >
              {tab === "deck" && (
                <>
                  <Field label="牌組名稱">
                    <input
                      value={settings.deckName}
                      maxLength={80}
                      placeholder="我的啤牌"
                      onChange={(event) =>
                        patchSettings({ deckName: event.target.value })
                      }
                    />
                  </Field>
                  <div className="section-label">
                    選擇牌組<span>{cards.length} 張</span>
                  </div>
                  <div
                    className="template-grid"
                    role="radiogroup"
                    aria-label="選擇牌組"
                    onKeyDown={radioKeys}
                  >
                    {Object.entries(TEMPLATES).map(([id, item]) => (
                      <button
                        key={id}
                        className={`template-choice ${project.template === id ? "selected" : ""}`}
                        role="radio"
                        tabIndex={project.template === id ? 0 : -1}
                        aria-checked={project.template === id}
                        onClick={() => {
                          if (id !== project.template) applyTemplate(id);
                        }}
                      >
                        <span className="template-symbol">
                          {id === "poker52" ? (
                            "♠"
                          ) : id === "poker54" ? (
                            "♛"
                          ) : id === "uno108" ? (
                            <span className="uno-dots">
                              <i />
                              <i />
                              <i />
                              <i />
                            </span>
                          ) : (
                            <Layers3 size={21} />
                          )}
                        </span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                        {project.template === id && (
                          <Check size={14} className="choice-check" />
                        )}
                      </button>
                    ))}
                  </div>
                  {project.template === "custom" && (
                    <div className="custom-count-row">
                      <Field label="自訂張數">
                        <input
                          aria-label="自訂張數"
                          type="number"
                          min="1"
                          max={MAX_CARDS}
                          value={customCount}
                          onChange={(event) =>
                            setCustomCount(event.target.value)
                          }
                        />
                      </Field>
                      <button
                        className="button secondary"
                        onClick={() => {
                          const number = Number(customCount);
                          if (
                            !Number.isInteger(number) ||
                            number < 1 ||
                            number > MAX_CARDS
                          ) {
                            notify("請輸入 1–160 之間的整數。", "error");
                            return;
                          }
                          applyTemplate("custom", number);
                        }}
                      >
                        建立牌組
                      </button>
                    </div>
                  )}

                  <div className="section-label">
                    列印紙張與每張紙牌數
                    <span>
                      {plan.layout.cardWidth} × {plan.layout.cardHeight} mm
                    </span>
                  </div>
                  <Segmented
                    label="選擇列印紙張"
                    options={[
                      { id: "a4", label: "A4 紙" },
                      { id: "r3", label: "3R（預設 2 張）" },
                      { id: "r4", label: "4R（預設 2 張）" },
                    ]}
                    value={settings.print.paper}
                    onChange={changePaper}
                  />
                  {settings.print.paper === "a4" ? (
                    <div className="sheet-count-picker">
                      <div
                        className="per-sheet-chips"
                        role="group"
                        aria-label="1 張 A4 紙印幾張牌快速選擇"
                      >
                        {A4_CHOICES.map((count) => (
                          <button
                            key={count}
                            type="button"
                            className={`chip-button ${settings.print.perSheet === count ? "selected" : ""}`}
                            aria-pressed={settings.print.perSheet === count}
                            onClick={() => {
                              patchPrint({ perSheet: count });
                              setSheetIndex(0);
                            }}
                          >
                            {count} 張
                          </button>
                        ))}
                      </div>
                      <Field
                        label="1 張 A4 紙印幾張牌（1–160）"
                        hint={`${plan.layout.cols} × ${plan.layout.rows} 排列 · 每張卡 ${plan.layout.cardWidth} × ${plan.layout.cardHeight} mm · 共 ${plan.sheets} 張 A4`}
                      >
                        <input
                          type="number"
                          min="1"
                          max={MAX_CARDS}
                          aria-label="1 張 A4 紙印幾張牌"
                          value={settings.print.perSheet}
                          onChange={(event) => {
                            const next = clamp(
                              event.target.value,
                              1,
                              MAX_CARDS,
                              9,
                            );
                            patchPrint({ perSheet: Math.round(next) });
                            setSheetIndex(0);
                          }}
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="sheet-count-picker">
                      <Segmented
                        label="每張相片紙卡牌數量"
                        options={[
                          { id: 2, label: "2 張（標準 63 × 88 mm）" },
                          { id: 1, label: "1 張（單張置中）" },
                        ]}
                        value={settings.print.perSheet}
                        onChange={(perSheet) => {
                          patchPrint({ perSheet });
                          setSheetIndex(0);
                        }}
                      />
                      <p className="field-hint">
                        預設 1 張 {settings.print.paper === "r3" ? "3R" : "4R"}{" "}
                        印 2 張卡，剛好是 63 × 88 mm 正常卡牌大小。
                      </p>
                    </div>
                  )}

                  <div className="browser-designs-box">
                    <div className="section-label">
                      瀏覽器儲存的設計
                      <span>{savedDesigns.length} 個存檔</span>
                    </div>
                    <button
                      type="button"
                      className="button secondary full-width"
                      onClick={() => handleSaveToBrowser(true)}
                    >
                      <BookmarkPlus size={16} />
                      將目前設計存入瀏覽器
                    </button>
                    {savedDesigns.length > 0 ? (
                      <div
                        className="saved-design-list"
                        aria-label="瀏覽器已儲存的設計"
                      >
                        {savedDesigns.slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            className={`saved-design-row ${activeDesignId === item.id ? "current" : ""}`}
                          >
                            <div className="saved-design-info">
                              <strong>{item.name}</strong>
                              <small>
                                {item.cardCount} 張 ·{" "}
                                {formatSavedTime(item.updatedAt)}
                              </small>
                            </div>
                            <button
                              type="button"
                              className="button quiet compact-btn"
                              onClick={() => handleLoadFromBrowser(item)}
                            >
                              載入
                            </button>
                            <IconButton
                              label={`刪除 ${item.name}`}
                              className="danger-icon"
                              onClick={() => handleDeleteFromBrowser(item)}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </div>
                        ))}
                        {savedDesigns.length > 5 && (
                          <button
                            type="button"
                            className="text-button full-width"
                            onClick={() => setDesignsOpen(true)}
                          >
                            查看全部 {savedDesigns.length} 個設計
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="field-hint">
                        按上方按鈕即可在瀏覽器保存多個不同版本的卡牌設計，隨時切換載入。
                      </p>
                    )}
                  </div>

                  <div className="next-step-card">
                    <div>
                      <small>下一步，讓它有你的風格</small>
                      <strong>純牌也好，加圖文也好。</strong>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => chooseTab("front")}
                    >
                      設計牌面
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <details className="advanced">
                    <summary>
                      牌組管理
                      <ChevronDown size={15} />
                    </summary>
                    <div className="advanced-content">
                      <p className="field-hint">
                        所有卡牌都可以在下方選取，不限於首 80 張。
                      </p>
                      <button
                        className="button secondary full-width"
                        onClick={addCard}
                        disabled={cards.length >= MAX_CARDS}
                      >
                        <Plus size={16} />
                        加入一張自訂卡
                      </button>
                      <CardActions
                        activeCard={activeCard}
                        cards={cards}
                        onDuplicate={duplicateCard}
                        onRemove={removeCard}
                      />
                    </div>
                  </details>
                </>
              )}

              {tab === "front" && (
                <>
                  <div className="section-label">套用範圍</div>
                  <Segmented
                    label="牌面套用範圍"
                    options={[
                      { id: "deck", label: "整副牌" },
                      { id: "card", label: `只改 ${cardLabel(activeCard)}` },
                    ]}
                    value={scope}
                    onChange={setScope}
                  />
                  {scope === "deck" &&
                    Object.keys(activeCard.front).length > 0 && (
                      <div className="override-note">
                        這張牌另有個別內容。
                        <button onClick={() => setScope("card")}>
                          查看這張
                        </button>
                      </div>
                    )}
                  <div className="section-label">牌面方式</div>
                  <div
                    className="front-mode-grid"
                    role="radiogroup"
                    aria-label="牌面方式"
                    onKeyDown={radioKeys}
                  >
                    {FRONT_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        className={`front-mode ${front.mode === mode.id ? "selected" : ""}`}
                        role="radio"
                        tabIndex={front.mode === mode.id ? 0 : -1}
                        aria-label={mode.label}
                        aria-checked={front.mode === mode.id}
                        onClick={() =>
                          patchFront({
                            mode: mode.id,
                            ...(mode.id === "text"
                              ? { showIndices: true }
                              : mode.id === "image"
                                ? { showIndices: false }
                                : {}),
                          })
                        }
                      >
                        <span className={`mode-mini mini-${mode.id}`}>
                          {mode.id === "pure" ? (
                            <span>♠</span>
                          ) : mode.id === "logo" ? (
                            <>
                              <span>♠</span>
                              <i>LOGO</i>
                            </>
                          ) : mode.id === "image" ? (
                            <ImageIcon size={21} strokeWidth={1.4} />
                          ) : (
                            <Type size={21} strokeWidth={1.6} />
                          )}
                        </span>
                        <strong>{mode.label}</strong>
                        {front.mode === mode.id && (
                          <Check size={13} className="choice-check" />
                        )}
                      </button>
                    ))}
                  </div>
                  {front.mode === "pure" && (
                    <div className="info-note subtle">
                      <CheckCheck size={19} />
                      <div>
                        <strong>保留一副正常啤牌</strong>
                        <p>
                          標準花色、正確點數、雙向角標，以及 J / Q / K
                          人像。沒有多餘圖示或文字。
                        </p>
                      </div>
                    </div>
                  )}
                  {front.mode === "logo" && (
                    <>
                      <div className="section-label small-label">
                        正中間花色與位置
                      </div>
                      <Segmented
                        label="Logo 是否取代正中間花色"
                        options={[
                          {
                            id: "keep",
                            label: "保留中間花色",
                          },
                          {
                            id: "replace",
                            label: "取代正中間花色（占正中央）",
                          },
                        ]}
                        value={front.replaceCenter ? "replace" : "keep"}
                        onChange={(choiceId) => {
                          const replaceCenter = choiceId === "replace";
                          patchFront({ replaceCenter });
                          if (replaceCenter) {
                            patchSettings({
                              logoPosition: "center",
                              ...(settings.logoSize < 22
                                ? { logoSize: 24 }
                                : {}),
                            });
                          }
                        }}
                      />
                      <UploadZone
                        label="上傳小 LOGO"
                        hint="PNG、JPG 或 SVG · 支援透明底"
                        value={settings.logo}
                        target="logo"
                        busy={busy}
                        onUpload={(files) => uploadImages(files, "logo")}
                        onRemove={() => patchSettings({ logo: "" })}
                      />
                      <Field
                        label={
                          <span className="range-label">
                            Logo 大小<strong>{settings.logoSize} mm</strong>
                          </span>
                        }
                        hint={
                          front.replaceCenter
                            ? "已取代正中間花色並占圖正中央位置，可自由調大。"
                            : "保留原本中間花色，同時加上 Logo。"
                        }
                      >
                        <input
                          type="range"
                          min="5"
                          max="45"
                          step="1"
                          value={settings.logoSize}
                          onChange={(event) =>
                            patchSettings({
                              logoSize: Number(event.target.value),
                            })
                          }
                          aria-label="Logo 大小"
                        />
                      </Field>
                      {!front.replaceCenter && (
                        <Field label="Logo 位置">
                          <select
                            value={settings.logoPosition}
                            onChange={(event) =>
                              patchSettings({
                                logoPosition: event.target.value,
                              })
                            }
                          >
                            <option value="center">正中央（占圖正中央）</option>
                            <option value="bottom-center">下方中央</option>
                            <option value="top-right">右上方</option>
                            <option value="bottom-left">左下方</option>
                          </select>
                        </Field>
                      )}
                      <p className="field-hint">
                        Logo 圖片與大小全副共用；套用範圍決定哪些牌面顯示它。
                      </p>
                    </>
                  )}
                  {front.mode === "image" && (
                    <>
                      <UploadZone
                        label="上傳完整牌面"
                        hint={
                          scope === "card"
                            ? "可多選圖片，從這張牌起順序加入"
                            : "相片、插畫，或已有角標的整張牌"
                        }
                        value={front.art}
                        target="front"
                        multiple={scope === "card"}
                        busy={busy}
                        onUpload={(files) => uploadImages(files, "front")}
                        onRemove={() => patchFront({ art: "" })}
                      />
                      <div className="section-label small-label">圖片顯示</div>
                      <Segmented
                        label="牌面圖片顯示"
                        options={[
                          { id: "cover", label: "填滿 · 裁切" },
                          { id: "contain", label: "完整顯示" },
                        ]}
                        value={front.fit}
                        onChange={(fit) => patchFront({ fit })}
                      />
                      <div className="section-label small-label">
                        正中間花色顯示
                      </div>
                      <Segmented
                        label="完整圖片是否顯示正中間花色"
                        options={[
                          {
                            id: "hide",
                            label: "不顯示（不擋圖案）",
                          },
                          {
                            id: "show",
                            label: "顯示正中間花色（似啤牌）",
                          },
                        ]}
                        value={front.showCenterSuit ? "show" : "hide"}
                        onChange={(choiceId) =>
                          patchFront({
                            showCenterSuit: choiceId === "show",
                          })
                        }
                      />
                      <p className="field-hint">
                        整張圖片加入時，想似啤牌可保留正中間花色；不想擋圖案就選不顯示。
                      </p>
                      <Toggle
                        label="保留白邊"
                        checked={front.frame === "white"}
                        onChange={(checked) =>
                          patchFront({ frame: checked ? "white" : "full" })
                        }
                      />
                      <Toggle
                        label="加上啤牌角標"
                        checked={front.showIndices}
                        onChange={(showIndices) => patchFront({ showIndices })}
                        hint="保留左上及右下點數與花色。"
                      />
                    </>
                  )}
                  {front.mode === "text" && (
                    <>
                      <div className="section-label small-label">
                        正中間花色與位置
                      </div>
                      <Segmented
                        label="純文字是否取代或顯示中間花色"
                        options={[
                          {
                            id: "replace",
                            label: "取代正中間花色",
                          },
                          {
                            id: "show",
                            label: "顯示中間花色",
                          },
                          {
                            id: "none",
                            label: "不顯示牌面",
                          },
                        ]}
                        value={
                          front.replaceCenter
                            ? "replace"
                            : front.showCenterSuit
                              ? "show"
                              : "none"
                        }
                        onChange={(choiceId) =>
                          patchFront({
                            replaceCenter: choiceId === "replace",
                            showCenterSuit: choiceId === "show",
                            ...(choiceId === "replace"
                              ? { showIndices: true }
                              : {}),
                          })
                        }
                      />
                      <Field
                        label={
                          <span className="range-label">
                            文字大小
                            <strong>{front.textSize || 130}%</strong>
                          </span>
                        }
                        hint="文字占圖正中央位置，可自由放大或縮小。"
                      >
                        <input
                          type="range"
                          min="60"
                          max="220"
                          step="5"
                          value={front.textSize || 130}
                          onChange={(event) =>
                            patchFront({
                              textSize: Number(event.target.value),
                            })
                          }
                          aria-label="文字大小"
                        />
                      </Field>
                      <Field label="標題">
                        <input
                          value={front.title}
                          maxLength={80}
                          placeholder="例如：積雲 / 今日任務"
                          onChange={(event) =>
                            patchFront({ title: event.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="內容"
                        hint="自動置於正中央及縮放；建議 150 字以內。"
                      >
                        <textarea
                          value={front.body}
                          maxLength={600}
                          rows={4}
                          placeholder="把想說的話，放進這張牌。"
                          onChange={(event) =>
                            patchFront({ body: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="底部小字（可留空）">
                        <input
                          value={front.footer}
                          maxLength={80}
                          placeholder="例如：氣象組 / 活動名稱"
                          onChange={(event) =>
                            patchFront({ footer: event.target.value })
                          }
                        />
                      </Field>
                      <Toggle
                        label="保留啤牌角標"
                        checked={front.showIndices}
                        onChange={(showIndices) => patchFront({ showIndices })}
                      />
                    </>
                  )}
                  <details className="advanced">
                    <summary>
                      這張牌與其他設定
                      <ChevronDown size={15} />
                    </summary>
                    <div className="advanced-content">
                      {activeCard.kind === "poker" ? (
                        <div className="field-pair">
                          <Field label="點數">
                            <select
                              value={activeCard.rank}
                              onChange={(event) =>
                                patchCard({
                                  rank: event.target.value,
                                  number: `${event.target.value}${SUITS.find((suit) => suit.id === activeCard.suit).symbol}`,
                                })
                              }
                            >
                              {RANKS.map((rank) => (
                                <option key={rank}>{rank}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="花色">
                            <select
                              value={activeCard.suit}
                              onChange={(event) =>
                                patchCard({
                                  suit: event.target.value,
                                  number: `${activeCard.rank}${SUITS.find((suit) => suit.id === event.target.value).symbol}`,
                                })
                              }
                            >
                              {SUITS.map((suit) => (
                                <option value={suit.id} key={suit.id}>
                                  {suit.symbol} {suit.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      ) : (
                        <Field label="卡號">
                          <input
                            value={activeCard.number}
                            maxLength={30}
                            onChange={(event) =>
                              patchCard({ number: event.target.value })
                            }
                          />
                        </Field>
                      )}
                      <Field label="全副版權小字（可留空）">
                        <input
                          value={settings.copyright}
                          maxLength={100}
                          placeholder="不填就不顯示"
                          onChange={(event) =>
                            patchSettings({ copyright: event.target.value })
                          }
                        />
                      </Field>
                      {Object.keys(activeCard.front).length > 0 && (
                        <button
                          className="button quiet full-width"
                          onClick={() => {
                            patchCard({ front: {} });
                            notify("這張牌已回復全副設定。");
                          }}
                        >
                          <RotateCcw size={15} />
                          這張牌回復全副設定
                        </button>
                      )}
                      <CardActions
                        activeCard={activeCard}
                        cards={cards}
                        onDuplicate={duplicateCard}
                        onRemove={removeCard}
                      />
                      <button
                        className="button quiet full-width"
                        onClick={addCard}
                        disabled={cards.length >= MAX_CARDS}
                      >
                        <Plus size={15} />
                        加入一張自訂卡
                      </button>
                    </div>
                  </details>
                </>
              )}

              {tab === "back" && (
                <>
                  <div className="section-label">
                    經典牌背<span>180° 對稱</span>
                  </div>
                  <div
                    className="back-pattern-grid"
                    role="radiogroup"
                    aria-label="牌背花紋"
                    onKeyDown={radioKeys}
                  >
                    {BACK_PATTERNS.map((pattern) => (
                      <button
                        className={`back-pattern ${settings.back.pattern === pattern.id ? "selected" : ""}`}
                        role="radio"
                        tabIndex={
                          settings.back.pattern === pattern.id ||
                          (settings.back.pattern === "upload" &&
                            pattern.id === "classic")
                            ? 0
                            : -1
                        }
                        aria-checked={settings.back.pattern === pattern.id}
                        key={pattern.id}
                        onClick={() => patchBack({ pattern: pattern.id })}
                      >
                        <span className="back-sample">
                          <BackArtwork
                            pattern={pattern.id}
                            color={settings.back.color}
                          />
                        </span>
                        <strong>{pattern.label}</strong>
                        {settings.back.pattern === pattern.id && (
                          <Check size={13} className="choice-check" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="section-label">牌背顏色</div>
                  <div className="color-swatches">
                    {BACK_COLORS.map((color, index) => (
                      <button
                        key={color}
                        className={`color-swatch ${settings.back.color === color ? "selected" : ""}`}
                        style={{ "--swatch-color": color }}
                        aria-label={`${["綠", "藍", "紅", "黑"][index]}色牌背`}
                        aria-pressed={settings.back.color === color}
                        onClick={() => patchBack({ color })}
                      >
                        {settings.back.color === color && <Check size={16} />}
                      </button>
                    ))}
                    <label className="custom-color" title="自訂牌背顏色">
                      <span>＋</span>
                      <input
                        aria-label="自訂牌背顏色"
                        type="color"
                        value={settings.back.color}
                        onChange={(event) =>
                          patchBack({ color: event.target.value })
                        }
                      />
                    </label>
                    <span className="color-value">
                      {settings.back.color.toUpperCase()}
                    </span>
                  </div>
                  <div className="section-divider">
                    <span>或者，用自己的圖案</span>
                  </div>
                  <UploadZone
                    label="上傳完整牌背"
                    hint="PNG、JPG 或 SVG · 全副牌共用"
                    value={
                      settings.back.pattern === "upload"
                        ? settings.back.art
                        : ""
                    }
                    target="back"
                    busy={busy}
                    onUpload={(files) => uploadImages(files, "back")}
                    onRemove={() => patchBack({ art: "", pattern: "classic" })}
                  />
                  {settings.back.art && settings.back.pattern !== "upload" && (
                    <button
                      className="button quiet full-width"
                      onClick={() => patchBack({ pattern: "upload" })}
                    >
                      <ImageIcon size={15} />
                      使用之前上傳的牌背
                    </button>
                  )}
                  {settings.back.pattern === "upload" && (
                    <>
                      <Segmented
                        label="牌背圖片顯示"
                        options={[
                          { id: "cover", label: "填滿 · 裁切" },
                          { id: "contain", label: "完整顯示" },
                        ]}
                        value={settings.back.fit}
                        onChange={(fit) => patchBack({ fit })}
                      />
                      <Toggle
                        label="保留牌背白邊"
                        checked={settings.back.frame === "white"}
                        onChange={(checked) =>
                          patchBack({ frame: checked ? "white" : "full" })
                        }
                      />
                    </>
                  )}
                  <div className="info-note subtle">
                    <Layers3 size={18} />
                    <div>
                      <strong>全副共用同一牌背</strong>
                      <p>
                        預設只有花紋及白邊，不會放大 Logo，也不會印上牌組名稱。
                      </p>
                    </div>
                  </div>
                  <details className="advanced">
                    <summary>
                      加入小 Logo 或文字
                      <ChevronDown size={15} />
                    </summary>
                    <div className="advanced-content">
                      <Toggle
                        label="牌背加入小 Logo"
                        checked={settings.back.showLogo}
                        onChange={(showLogo) => patchBack({ showLogo })}
                        hint={`共用牌面 Logo，${settings.logoSize} mm，置於中央。`}
                      />
                      {settings.back.showLogo && (
                        <UploadZone
                          label="上傳牌背 LOGO"
                          hint="與牌面共用同一張 Logo"
                          value={settings.logo}
                          target="logo"
                          busy={busy}
                          onUpload={(files) => uploadImages(files, "logo")}
                          onRemove={() => patchSettings({ logo: "" })}
                        />
                      )}
                      <Field
                        label="牌背文字（可留空）"
                        hint="文字會成對、反向顯示，保持雙向設計。"
                      >
                        <input
                          value={settings.back.text}
                          maxLength={60}
                          placeholder="例如：氣象組"
                          onChange={(event) =>
                            patchBack({ text: event.target.value })
                          }
                        />
                      </Field>
                    </div>
                  </details>
                </>
              )}

              {tab === "print" && (
                <>
                  <div className="duplex-banner">
                    <span className="duplex-icon">
                      <FlipHorizontal2 size={21} />
                    </span>
                    <div>
                      <strong>正反配對，雙面輸出</strong>
                      <p>正 1 → 反 1 → 正 2 → 反 2…</p>
                    </div>
                    <CheckCheck size={18} />
                  </div>
                  <Field label="紙張">
                    <select
                      value={settings.print.paper}
                      onChange={(event) => changePaper(event.target.value)}
                    >
                      {Object.entries(PAPERS).map(([id, paper]) => (
                        <option key={id} value={id}>
                          {paper.label}
                          {id === "a4"
                            ? " · 210 × 297 mm"
                            : id === "r3"
                              ? " · 預設 2 張卡（63 × 88 mm）"
                              : ` · ${paper.width} × ${paper.height} mm`}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {settings.print.paper === "a4" ? (
                    <>
                      <div className="section-label">
                        1 張 A4 紙印幾張牌
                        <span>
                          {plan.layout.cols} × {plan.layout.rows}
                        </span>
                      </div>
                      <div
                        className="per-sheet-chips"
                        role="group"
                        aria-label="A4 每張紙卡牌數量"
                      >
                        {A4_CHOICES.map((count) => (
                          <button
                            key={count}
                            type="button"
                            className={`chip-button ${settings.print.perSheet === count ? "selected" : ""}`}
                            aria-pressed={settings.print.perSheet === count}
                            onClick={() => {
                              patchPrint({ perSheet: count });
                              setSheetIndex(0);
                            }}
                          >
                            {count} 張
                          </button>
                        ))}
                      </div>
                      <Field
                        label="自訂每張 A4 印幾張牌（1–160）"
                        hint={
                          plan.layout.cardWidth === 63 &&
                          plan.layout.cardHeight === 88
                            ? `保持標準卡牌大小 63 × 88 mm（${plan.layout.cols} × ${plan.layout.rows} 排列）。`
                            : `自動排版為 ${plan.layout.cols} × ${plan.layout.rows}，每張卡約 ${plan.layout.cardWidth} × ${plan.layout.cardHeight} mm。`
                        }
                      >
                        <input
                          type="number"
                          min="1"
                          max={MAX_CARDS}
                          aria-label="自訂每張 A4 印幾張牌"
                          value={settings.print.perSheet}
                          onChange={(event) => {
                            const next = clamp(
                              event.target.value,
                              1,
                              MAX_CARDS,
                              9,
                            );
                            patchPrint({ perSheet: Math.round(next) });
                            setSheetIndex(0);
                          }}
                        />
                      </Field>
                    </>
                  ) : (
                    <>
                      <div className="section-label">
                        每張 {settings.print.paper === "r3" ? "3R" : "4R"}{" "}
                        印幾張牌
                      </div>
                      <Segmented
                        label="每張相片紙卡牌數量"
                        options={[
                          { id: 2, label: "2 張 · 正常卡牌大小" },
                          { id: 1, label: "1 張 · 單張置中" },
                        ]}
                        value={settings.print.perSheet}
                        onChange={(perSheet) => {
                          patchPrint({ perSheet });
                          setSheetIndex(0);
                        }}
                      />
                      <p className="field-hint">
                        預設 3R 印 2 張卡，每張 63 × 88 mm（正正是正常卡牌大小）。
                      </p>
                    </>
                  )}
                  <div className="section-label">雙面翻頁方式</div>
                  <Segmented
                    label="雙面翻頁方式"
                    options={[
                      { id: "long", label: "長邊翻頁" },
                      { id: "short", label: "短邊翻頁" },
                    ]}
                    value={settings.print.flip}
                    onChange={(flip) => patchPrint({ flip })}
                  />
                  <p className="field-hint">
                    {settings.print.flip === "long"
                      ? "建議選長邊。牌背位置已左右對位，不會鏡像圖片。"
                      : "上下對位，牌背自動轉 180°，保持成品方向一致。"}
                  </p>
                  {settings.print.paper === "a4" && (
                    <Toggle
                      label="加入裁切標記"
                      checked={settings.print.cutMarks}
                      onChange={(cutMarks) => patchPrint({ cutMarks })}
                      hint="只在正面加裁切線，背面不加多餘線條。"
                    />
                  )}
                  <div className="output-summary">
                    <div>
                      <strong>
                        {plan.sheets}
                        <small>
                          {" "}
                          張
                          {settings.print.paper === "a4"
                            ? " A4 紙"
                            : settings.print.paper === "r3"
                              ? " 3R 相片紙"
                              : " 4R 相片紙"}
                        </small>
                      </strong>
                      <span>
                        每張 {plan.layout.count} 隻 · 共 {cards.length} 張牌
                      </span>
                    </div>
                    <div>
                      <strong>
                        {plan.pages.length}
                        <small> 頁 PDF</small>
                      </strong>
                      <span>
                        每卡 {plan.layout.cardWidth} × {plan.layout.cardHeight}{" "}
                        mm
                      </span>
                    </div>
                  </div>
                  <div className="print-instructions">
                    <strong>
                      <Printer size={16} />
                      列印視窗請這樣選
                    </strong>
                    <ol>
                      <li>
                        <span>1</span>
                        <p>
                          <b>
                            雙面列印 ·{" "}
                            {settings.print.flip === "long" ? "長邊" : "短邊"}
                            翻頁
                          </b>
                          須與上面的翻頁設定相同
                        </p>
                      </li>
                      <li>
                        <span>2</span>
                        <p>
                          <b>原尺寸 / 100%</b>不要用「符合頁面」或縮放
                        </p>
                      </li>
                      <li>
                        <span>3</span>
                        <p>
                          <b>開啟背景圖形，關閉頁首頁尾</b>
                          確保牌背花紋及顏色完整輸出
                        </p>
                      </li>
                    </ol>
                  </div>
                  <details className="advanced">
                    <summary>
                      對位微調 / 手動雙面
                      <ChevronDown size={15} />
                    </summary>
                    <div className="advanced-content">
                      <p className="field-hint">
                        先試印，再按打印機偏差微調牌背；牌面位置不變。
                      </p>
                      <div className="field-pair">
                        <Field label="牌背左右（mm）">
                          <input
                            type="number"
                            min="-3"
                            max="3"
                            step="0.1"
                            value={settings.print.offsetX}
                            onChange={(event) =>
                              patchPrint({
                                offsetX: clamp(event.target.value, -3, 3, 0),
                              })
                            }
                          />
                        </Field>
                        <Field label="牌背上下（mm）">
                          <input
                            type="number"
                            min="-3"
                            max="3"
                            step="0.1"
                            value={settings.print.offsetY}
                            onChange={(event) =>
                              patchPrint({
                                offsetY: clamp(event.target.value, -3, 3, 0),
                              })
                            }
                          />
                        </Field>
                      </div>
                      <p className="field-hint">
                        正數向右／向下；負數向左／向上。
                      </p>
                      <button
                        className="button quiet full-width"
                        onClick={() => patchPrint({ offsetX: 0, offsetY: 0 })}
                      >
                        <RotateCcw size={15} />
                        重設對位
                      </button>
                      <div className="manual-help">
                        <strong>沒有自動雙面打印機？</strong>
                        <p>
                          先列印 PDF
                          奇數頁（正面），再按機款入紙方向重放，列印偶數頁（反面）。部分機款需要逆序，請先試印一張確認。
                        </p>
                      </div>
                    </div>
                  </details>
                </>
              )}
            </fieldset>
            {tab === "print" && (
              <div className="inspector-print-actions">
                <button
                  className="button primary full-width print-main"
                  disabled={busy || printing}
                  onClick={() => preparePrint(false)}
                >
                  {printing ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <Printer size={17} />
                  )}
                  {printing ? "列印視窗已開啟…" : "列印 / 存成 PDF"}
                  {!printing && <ArrowRight size={16} />}
                </button>
                <button
                  className="button quiet full-width test-print"
                  disabled={busy || printing}
                  onClick={() => preparePrint(true)}
                >
                  先試印第 1 張紙（正＋反）
                </button>
                {printing && (
                  <button
                    className="text-button full-width"
                    onClick={() => {
                      setPrinting(false);
                      setFirstSheetOnly(false);
                    }}
                  >
                    列印視窗已關閉？返回編輯
                  </button>
                )}
              </div>
            )}
          </aside>

          <section className="studio" aria-label="卡牌預覽及牌組">
            <div className="studio-heading">
              <div>
                <div className="studio-eyebrow">MAKE IT YOURS</div>
                <h2>
                  <span className="deck-name-title" title={settings.deckName}>
                    {settings.deckName || "我的啤牌"}
                  </span>
                  <span className="deck-count-badge">{cards.length} 張</span>
                </h2>
              </div>
              <div className="history-actions">
                <IconButton
                  label="復原"
                  disabled={!canUndo || busy}
                  onClick={undo}
                >
                  <Undo2 size={18} />
                </IconButton>
                <IconButton
                  label="重做"
                  disabled={!canRedo || busy}
                  onClick={redo}
                >
                  <Redo2 size={18} />
                </IconButton>
              </div>
            </div>
            <section className="canvas-panel">
              <div className="canvas-toolbar">
                <Segmented
                  className="view-toggle"
                  label="預覽模式"
                  options={[
                    {
                      id: "cards",
                      label: (
                        <>
                          <CreditCard size={15} />
                          卡牌預覽
                        </>
                      ),
                    },
                    {
                      id: "sheets",
                      label: (
                        <>
                          <Layers3 size={15} />
                          雙面排版
                        </>
                      ),
                    },
                  ]}
                  value={view}
                  onChange={chooseView}
                />
                <div className="canvas-live">
                  <span />
                  即時預覽
                </div>
                <div className="zoom-controls">
                  <IconButton
                    label="縮小預覽"
                    disabled={zoom <= 45}
                    onClick={() => {
                      autoFit.current = false;
                      setZoom((value) => Math.max(45, value - 10));
                    }}
                  >
                    <Minus size={15} />
                  </IconButton>
                  <button
                    className="zoom-value"
                    title="回復 100%"
                    onClick={() => {
                      autoFit.current = false;
                      setZoom(100);
                    }}
                  >
                    {zoom}%
                  </button>
                  <IconButton
                    label="放大預覽"
                    disabled={zoom >= 150}
                    onClick={() => {
                      autoFit.current = false;
                      setZoom((value) => Math.min(150, value + 10));
                    }}
                  >
                    <Plus size={15} />
                  </IconButton>
                  <span />
                  <IconButton
                    label="符合預覽視窗"
                    onClick={() => {
                      autoFit.current = true;
                      setZoom(fitZoom());
                    }}
                  >
                    <Expand size={16} />
                  </IconButton>
                </div>
              </div>
              <div
                className={`canvas-stage ${view === "sheets" ? "sheet-stage" : ""}`}
                ref={stageRef}
              >
                {view === "cards" ? (
                  <div
                    className="card-pair"
                    style={{
                      "--card-width": `${(238 * zoom) / 100}px`,
                      "--card-height": `${(((238 * zoom) / 100) * 88) / 63}px`,
                    }}
                  >
                    <div className="preview-card-item">
                      <div className="preview-label">
                        <span className="face-label-dot" />
                        <strong>牌面</strong>
                        <span>{cardLabel(activeCard)}</span>
                      </div>
                      <button
                        className={`preview-card-button ${tab === "front" ? "editing" : ""}`}
                        aria-label="編輯牌面"
                        onClick={() => chooseTab("front")}
                      >
                        <PlayingCard card={activeCard} settings={settings} />
                      </button>
                      <span className="card-size-label">63 × 88 mm</span>
                    </div>
                    <div className="preview-card-item">
                      <div className="preview-label">
                        <span className="back-label-dot" />
                        <strong>牌背</strong>
                        <span>全副共用</span>
                      </div>
                      <button
                        className={`preview-card-button ${tab === "back" ? "editing" : ""}`}
                        aria-label="編輯牌背"
                        onClick={() => chooseTab("back")}
                      >
                        <PlayingCard
                          card={activeCard}
                          side="back"
                          settings={settings}
                        />
                      </button>
                      <span className="card-size-label">
                        {settings.back.pattern === "upload"
                          ? "自訂牌背 · 全副共用"
                          : settings.back.showLogo
                            ? "花紋牌背 · 小 Logo"
                            : "對稱牌背 · 雙向設計"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="sheet-pair"
                    style={{
                      "--preview-paper-width": `${(260 * zoom) / 100}px`,
                    }}
                  >
                    {plan.pages
                      .slice(currentSheet * 2, currentSheet * 2 + 2)
                      .map((page) => (
                        <div className="sheet-preview-item" key={page.side}>
                          <div className="preview-label">
                            <span
                              className={
                                page.side === "front"
                                  ? "face-label-dot"
                                  : "back-label-dot"
                              }
                            />
                            <strong>
                              {page.side === "front" ? "正面" : "反面"}
                            </strong>
                            <span>
                              PDF 第{" "}
                              {currentSheet * 2 +
                                (page.side === "front" ? 1 : 2)}{" "}
                              頁
                            </span>
                          </div>
                          <PrintPage
                            page={page}
                            layout={plan.layout}
                            settings={settings}
                            sheets={plan.sheets}
                            preview
                          />
                          <span className="card-size-label">
                            {page.side === "front"
                              ? `${plan.layout.label} · 每張紙 ${plan.layout.count} 張卡`
                              : `${settings.print.flip === "long" ? "左右" : "上下"}對位${page.rotation ? " · 牌背轉 180°" : " · 圖案不鏡像"}`}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
                <div className="canvas-bottom-note">
                  {view === "cards" ? (
                    <>
                      <ShieldCheck size={14} />
                      <span>標準尺寸</span>
                      <i />
                      <span>正反面一目了然</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck size={14} />
                      <span>正反頁已配對</span>
                      <i />
                      <span>最後一頁保留空格對位</span>
                    </>
                  )}
                </div>
              </div>
              <div className="canvas-statusbar">
                {view === "cards" ? (
                  <>
                    <div className="card-navigation">
                      <IconButton
                        label="上一張牌"
                        onClick={() => navigateCard(-1)}
                      >
                        <ChevronLeft size={16} />
                      </IconButton>
                      <span>
                        <strong>{cardLabel(activeCard)}</strong>
                        <small>
                          第 {activeIndex + 1} / {cards.length} 張
                        </small>
                      </span>
                      <IconButton
                        label="下一張牌"
                        onClick={() => navigateCard(1)}
                      >
                        <ChevronRight size={16} />
                      </IconButton>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setScope("card");
                        chooseTab("front");
                      }}
                    >
                      編輯這張牌
                      <ArrowRight size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="card-navigation">
                      <IconButton
                        label="上一張紙"
                        disabled={currentSheet === 0}
                        onClick={() => setSheetIndex(currentSheet - 1)}
                      >
                        <ChevronLeft size={16} />
                      </IconButton>
                      <span>
                        <strong>
                          第 {currentSheet + 1} / {plan.sheets} 張紙
                        </strong>
                        <small>
                          共 {plan.pages.length} 頁 · 每張 1 正 + 1 反
                        </small>
                      </span>
                      <IconButton
                        label="下一張紙"
                        disabled={currentSheet === plan.sheets - 1}
                        onClick={() => setSheetIndex(currentSheet + 1)}
                      >
                        <ChevronRight size={16} />
                      </IconButton>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => chooseTab("print")}
                    >
                      列印設定
                      <ArrowRight size={14} />
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="deck-panel" aria-labelledby="deck-heading">
              <div className="deck-toolbar">
                <div className="deck-title">
                  <Layers3 size={16} />
                  <h3 id="deck-heading">你的牌組</h3>
                  <span>{cards.length}</span>
                </div>
                <div
                  className="suit-filters"
                  role="group"
                  aria-label="按花色篩選"
                >
                  <button
                    className={suitFilter === "all" ? "active" : ""}
                    aria-pressed={suitFilter === "all"}
                    onClick={() => setSuitFilter("all")}
                  >
                    全部
                  </button>
                  {SUITS.filter((suit) =>
                    cards.some((card) => card.suit === suit.id),
                  ).map((suit) => (
                    <button
                      key={suit.id}
                      className={suitFilter === suit.id ? "active" : ""}
                      aria-label={suit.label}
                      aria-pressed={suitFilter === suit.id}
                      style={{ color: suit.color }}
                      onClick={() => {
                        setSuitFilter(suit.id);
                        if (activeCard.suit !== suit.id)
                          setActiveId(
                            cards.find((card) => card.suit === suit.id).id,
                          );
                      }}
                    >
                      {suit.symbol}
                    </button>
                  ))}
                  {cards.some((card) => card.kind === "joker") && (
                    <button
                      className={suitFilter === "joker" ? "active" : ""}
                      aria-pressed={suitFilter === "joker"}
                      onClick={() => {
                        setSuitFilter("joker");
                        setActiveId(
                          cards.find((card) => card.kind === "joker").id,
                        );
                      }}
                    >
                      皇
                    </button>
                  )}
                </div>
                <div className="deck-scroll-actions">
                  <IconButton
                    label="向左瀏覽牌組"
                    onClick={() =>
                      deckRef.current?.scrollBy({
                        left: -350,
                        behavior: "smooth",
                      })
                    }
                  >
                    <ChevronLeft size={16} />
                  </IconButton>
                  <IconButton
                    label="向右瀏覽牌組"
                    onClick={() =>
                      deckRef.current?.scrollBy({
                        left: 350,
                        behavior: "smooth",
                      })
                    }
                  >
                    <ChevronRight size={16} />
                  </IconButton>
                </div>
              </div>
              <div
                className="deck-strip"
                ref={deckRef}
                role="listbox"
                aria-label="選擇卡牌"
                onKeyDown={(event) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    if (event.key === "Home") setActiveId(filteredCards[0].id);
                    else if (event.key === "End")
                      setActiveId(filteredCards.at(-1).id);
                    else navigateCard(event.key === "ArrowRight" ? 1 : -1);
                  }
                }}
              >
                {filteredCards.map((card) => (
                  <button
                    key={card.id}
                    className={`deck-card ${card.id === activeCard.id ? "selected" : ""}`}
                    role="option"
                    aria-selected={card.id === activeCard.id}
                    aria-label={cardLabel(card)}
                    tabIndex={card.id === activeCard.id ? 0 : -1}
                    data-active={card.id === activeCard.id}
                    onClick={() => setActiveId(card.id)}
                  >
                    <span className="mini-card">
                      <PlayingCard card={card} settings={settings} />
                    </span>
                    <span className="mini-card-label">
                      {cardLabel(card)}
                      {Object.keys(card.front).length > 0 && (
                        <i title="獨立內容" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <footer className="studio-footer">
              <span>
                <Check size={13} />
                {storageStatus === "error"
                  ? "自動儲存暫不可用，請下載設計備份"
                  : "不用登入，設計保存在你的瀏覽器"}
              </span>
              <button onClick={() => setHelpOpen(true)}>
                快速使用說明
                <ExternalLink size={12} />
              </button>
            </footer>
          </section>
        </main>
        <footer className="app-footer" aria-label="網站版權">
          COPY RIGHT Scout System
        </footer>
        {notice && (
          <div
            className={`toast ${notice.tone}`}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            {notice.tone === "error" ? (
              <CircleHelp size={18} />
            ) : (
              <Check size={18} />
            )}
            <span>{notice.message}</span>
            <IconButton label="關閉訊息" onClick={() => setNotice(null)}>
              <X size={15} />
            </IconButton>
          </div>
        )}
        <SavedDesignsDialog
          open={designsOpen}
          onClose={() => setDesignsOpen(false)}
          savedDesigns={savedDesigns}
          activeDesignId={activeDesignId}
          currentDeckName={settings.deckName}
          onSaveNew={() => handleSaveToBrowser(true)}
          onUpdateCurrent={() => handleSaveToBrowser(false)}
          onLoad={handleLoadFromBrowser}
          onDelete={handleDeleteFromBrowser}
          onExportJson={() => {
            downloadProject(project);
            notify("設計檔已下載。");
          }}
        />
        <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
      <PrintOutput
        plan={plan}
        settings={settings}
        firstSheetOnly={firstSheetOnly}
      />
    </>
  );
}

function CardActions({ activeCard, cards, onDuplicate, onRemove }) {
  return (
    <div className="card-actions">
      <span>
        {cardLabel(activeCard)}
        <small>這張牌</small>
      </span>
      <IconButton
        label="複製這張牌"
        disabled={cards.length >= MAX_CARDS}
        onClick={onDuplicate}
      >
        <Copy size={16} />
      </IconButton>
      <IconButton
        label="刪除這張牌"
        className="danger-icon"
        disabled={cards.length <= 1}
        onClick={onRemove}
      >
        <Trash2 size={16} />
      </IconButton>
    </div>
  );
}

function SavedDesignsDialog({
  open,
  onClose,
  savedDesigns,
  activeDesignId,
  currentDeckName,
  onSaveNew,
  onUpdateCurrent,
  onLoad,
  onDelete,
  onExportJson,
}) {
  const dialog = useRef(null);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    else if (!open && dialog.current.open) dialog.current.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="help-dialog designs-dialog"
      aria-labelledby="designs-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <span className="dialog-icon">
          <FolderHeart size={23} />
        </span>
        <IconButton label="關閉我的設計" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </div>
      <small className="step-eyebrow">BROWSER STORAGE</small>
      <h2 id="designs-title">瀏覽器已儲存的設計</h2>
      <p className="dialog-subtitle">
        將你的不同牌組保存在此瀏覽器中，隨時一鍵載入或切換，無需登入。
      </p>
      <div className="dialog-save-actions">
        <button
          type="button"
          className="button primary"
          onClick={onSaveNew}
        >
          <BookmarkPlus size={16} />
          儲存「{currentDeckName || "我的啤牌"}」為新存檔
        </button>
        {activeDesignId && (
          <button
            type="button"
            className="button secondary"
            onClick={onUpdateCurrent}
          >
            <BookmarkCheck size={16} />
            更新目前存檔
          </button>
        )}
        <button
          type="button"
          className="button quiet"
          onClick={onExportJson}
        >
          <ArrowDownToLine size={16} />
          下載 JSON 備份
        </button>
      </div>

      {savedDesigns.length === 0 ? (
        <div className="empty-designs">
          <p>目前尚未儲存任何設計版本。按上方按鈕即可將目前設計存入瀏覽器。</p>
        </div>
      ) : (
        <div className="dialog-design-list">
          {savedDesigns.map((item) => (
            <div
              key={item.id}
              className={`dialog-design-card ${activeDesignId === item.id ? "current" : ""}`}
            >
              <div className="dialog-design-preview">
                <PlayingCard
                  card={item.project.cards[0]}
                  settings={item.project.settings}
                />
                <PlayingCard
                  card={item.project.cards[0]}
                  side="back"
                  settings={item.project.settings}
                />
              </div>
              <div className="dialog-design-meta">
                <strong>{item.name}</strong>
                <span>
                  {TEMPLATES[item.template]?.label || "自訂卡牌"} ·{" "}
                  {item.cardCount} 張
                </span>
                <small>儲存於 {formatSavedTime(item.updatedAt)}</small>
              </div>
              <div className="dialog-design-buttons">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => onLoad(item)}
                >
                  載入此設計
                </button>
                <IconButton
                  label={`刪除 ${item.name}`}
                  className="danger-icon"
                  onClick={() => onDelete(item)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </dialog>
  );
}

function HelpDialog({ open, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    else if (!open && dialog.current.open) dialog.current.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="help-dialog"
      aria-labelledby="help-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <span className="dialog-icon">
          <Sparkles size={23} />
        </span>
        <IconButton label="關閉使用說明" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </div>
      <small className="step-eyebrow">QUICK START</small>
      <h2 id="help-title">一副好牌，三步就好。</h2>
      <ol className="help-steps">
        <li>
          <span>01</span>
          <div>
            <strong>選牌組與每張紙印幾張牌</strong>
            <p>
              52 張、54 張、UNO 或自訂。可自由選擇 1 張 A4 印幾張牌，或選 3R
              相片紙（預設 1 張 3R 印 2 張正常大小卡牌）。
            </p>
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <strong>小 Logo 或純文字可取代正中間花色</strong>
            <p>
              小 Logo 與純文字都可選「取代正中間花色（正中央）」或「保留中間花色」，整副套用或只改一張都可以。
            </p>
          </div>
        </li>
        <li>
          <span>03</span>
          <div>
            <strong>瀏覽器儲存設計與雙面列印</strong>
            <p>
              可將多個設計儲存在瀏覽器「我的設計」隨時載入。正反頁已自動配對，列印時選相同翻頁方式及
              100% 原尺寸即可。
            </p>
          </div>
        </li>
      </ol>
      <div className="help-storage">
        <ShieldCheck size={18} />
        <p>
          設計與圖片只使用此瀏覽器儲存，不會上傳到伺服器。換裝置或清除瀏覽器資料前，亦可用「儲存設計」下載
          JSON 備份。
        </p>
      </div>
      <button className="button primary full-width" onClick={onClose}>
        開始設計
        <ArrowRight size={16} />
      </button>
    </dialog>
  );
}

createRoot(document.getElementById("root")).render(<App />);
