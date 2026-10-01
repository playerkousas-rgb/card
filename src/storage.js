import { createProject, normalizeProject } from "./model.js";

const STORAGE_KEY = "card-studio:project:v2";
const SAVED_DESIGNS_KEY = "card-studio:saved-designs:v1";
const MAX_SAVED_DESIGNS = 30;
let databasePromise;
let saveQueue = Promise.resolve();

function database() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = indexedDB.open("scout-card-studio", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("projects");
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          databasePromise = undefined;
        };
        resolve(db);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        databasePromise = undefined;
        reject(new Error("Storage is blocked"));
      };
    });
  }
  return databasePromise;
}

function loadLegacy() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored)
      return normalizeProject(JSON.parse(stored), { requireCards: true });
    const cards = JSON.parse(localStorage.getItem("cards"));
    if (!Array.isArray(cards) || !cards.length) return createProject();
    const fields = [
      "deckName",
      "copyright",
      "template",
      "printSize",
      "a4PerSheet",
      "backPattern",
      "backColor",
      "backUpload",
      "frontUpload",
    ];
    const legacy = Object.fromEntries(
      fields.map((key) => [key, localStorage.getItem(key)]),
    );
    return normalizeProject({ ...legacy, cards }, { requireCards: true });
  } catch {
    return createProject();
  }
}

export async function loadProject() {
  // A fallback write can be newer than an older IndexedDB record. Prefer it
  // until a successful IndexedDB write explicitly clears the fallback.
  try {
    const fallback = localStorage.getItem(STORAGE_KEY);
    if (fallback)
      return normalizeProject(JSON.parse(fallback), { requireCards: true });
  } catch {
    /* Invalid/blocked fallback storage should not prevent loading IDB. */
  }
  try {
    const db = await database();
    const saved = await new Promise((resolve, reject) => {
      const request = db
        .transaction("projects", "readonly")
        .objectStore("projects")
        .get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (saved) return normalizeProject(saved, { requireCards: true });
  } catch {
    /* Private mode and older browsers can fall back to local storage. */
  }
  return loadLegacy();
}

async function writeProject(project) {
  try {
    const db = await database();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      transaction.objectStore("projects").put(project, "current");
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error || new Error("Storage write aborted"));
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* IDB is already saved. */
    }
  } catch {
    // If both stores are full/blocked the rejection is shown in the UI rather
    // than silently claiming that artwork has been saved.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }
}

export function saveProject(project) {
  const save = saveQueue.catch(() => {}).then(() => writeProject(project));
  saveQueue = save;
  return save;
}

function sanitizeSavedDesigns(list) {
  if (!Array.isArray(list)) return [];
  const output = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    try {
      const project = normalizeProject(item.project || item, {
        requireCards: true,
      });
      const id =
        typeof item.id === "string" && item.id && !seen.has(item.id)
          ? item.id
          : crypto.randomUUID();
      seen.add(id);
      output.push({
        id,
        name: project.settings.deckName || "我的啤牌",
        template: project.template,
        cardCount: project.cards.length,
        updatedAt: Number.isFinite(Number(item.updatedAt))
          ? Number(item.updatedAt)
          : Date.now(),
        project,
      });
    } catch {
      /* Skip corrupted entries */
    }
  }
  return output
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SAVED_DESIGNS);
}

export async function loadSavedDesigns() {
  try {
    const fallback = localStorage.getItem(SAVED_DESIGNS_KEY);
    if (fallback) return sanitizeSavedDesigns(JSON.parse(fallback));
  } catch {
    /* Fall through to IndexedDB */
  }
  try {
    const db = await database();
    const saved = await new Promise((resolve, reject) => {
      const request = db
        .transaction("projects", "readonly")
        .objectStore("projects")
        .get("saved-designs");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (saved) return sanitizeSavedDesigns(saved);
  } catch {
    /* Ignore IDB read error */
  }
  return [];
}

async function writeSavedDesigns(designs) {
  try {
    const db = await database();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      transaction.objectStore("projects").put(designs, "saved-designs");
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error || new Error("Storage write aborted"));
    });
    try {
      localStorage.removeItem(SAVED_DESIGNS_KEY);
    } catch {
      /* IDB is already saved. */
    }
  } catch {
    localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(designs));
  }
}

export async function saveDesignToBrowser(project, existingId = null) {
  const cleanProject = normalizeProject(
    JSON.parse(JSON.stringify(project)),
    { requireCards: true },
  );
  const current = await loadSavedDesigns();
  const id =
    existingId && current.some((item) => item.id === existingId)
      ? existingId
      : crypto.randomUUID();
  const entry = {
    id,
    name: cleanProject.settings.deckName || "我的啤牌",
    template: cleanProject.template,
    cardCount: cleanProject.cards.length,
    updatedAt: Date.now(),
    project: cleanProject,
  };
  const next = [
    entry,
    ...current.filter((item) => item.id !== id),
  ].slice(0, MAX_SAVED_DESIGNS);
  await writeSavedDesigns(next);
  return { ok: true, entry, designs: next };
}

export async function deleteSavedDesign(id) {
  const current = await loadSavedDesigns();
  const next = current.filter((item) => item.id !== id);
  await writeSavedDesigns(next);
  return next;
}

export function downloadProject(project) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  // Portable ASCII filenames keep the .json extension on browsers/OS builds
  // that discard non-ASCII download names. The full deck name stays in JSON.
  const basename =
    (project.settings.deckName || "card-studio")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "card-studio";
  anchor.download = `${basename}-design.json`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
