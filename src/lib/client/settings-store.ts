import { load, type Store } from "@tauri-apps/plugin-store";
import { isTauri } from "@/lib/client/http";
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from "@/lib/core/settings";

/**
 * Settings used to live in `<cwd>/data/settings.json`, written with node:fs.
 * A packaged app has no trustworthy cwd — an install under Program Files is
 * read-only — so the file moves to the app data directory. `load()` resolves
 * its argument relative to that directory and writes plain JSON, so the file
 * stays hand-editable.
 */
const FILE = "settings.json";
const KEY = "settings";
/** Browser fallback, so `pnpm dev` is usable without the Tauri shell. */
const LS_KEY = "activity-view:settings";

let store: Store | null = null;
let pending: Promise<Store | null> | null = null;

async function getStore(): Promise<Store | null> {
  if (!isTauri()) return null;
  if (store) return store;
  if (!pending) {
    pending = load(FILE, { autoSave: false })
      .then((loaded) => (store = loaded))
      .catch(() => null);
  }
  return pending;
}

/** Reads, then re-validates: the file is plain JSON a user may have hand-edited. */
export async function loadSettings(): Promise<Settings> {
  const handle = await getStore();
  if (handle) {
    try {
      if (await handle.has(KEY)) return sanitizeSettings(await handle.get<unknown>(KEY));
    } catch {
      /* A corrupt store must not brick the dashboard. */
    }
    return sanitizeSettings(DEFAULT_SETTINGS);
  }

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return sanitizeSettings(JSON.parse(raw));
  } catch {
    /* Ignore unreadable local storage. */
  }
  return sanitizeSettings(DEFAULT_SETTINGS);
}

export async function saveSettings(next: Settings): Promise<Settings> {
  const clean = sanitizeSettings(next);
  const handle = await getStore();
  if (handle) {
    await handle.set(KEY, clean);
    await handle.save();
    return clean;
  }
  localStorage.setItem(LS_KEY, JSON.stringify(clean));
  return clean;
}

/** Whether the user has ever saved, which the settings page reports as "not persisted yet". */
export async function settingsPersisted(): Promise<boolean> {
  const handle = await getStore();
  if (handle) {
    try {
      return await handle.has(KEY);
    } catch {
      return false;
    }
  }
  return localStorage.getItem(LS_KEY) !== null;
}
