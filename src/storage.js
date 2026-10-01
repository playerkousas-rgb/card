import { createProject, normalizeProject } from "./model.js";

const STORAGE_KEY = "card-studio:project:v2";
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
