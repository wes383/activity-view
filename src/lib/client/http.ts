import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/** Requests to the local ActivityWatch server are on the order of milliseconds. */
const TIMEOUT_MS = 25_000;

/** True inside the Tauri webview, false when the same bundle runs in a browser. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const DEV_PROXY = "/__aw";
const DEFAULT_HOSTS = ["http://127.0.0.1:5600", "http://localhost:5600"];

/**
 * `pnpm dev` in a browser has no native client to lean on, so the Vite dev
 * server relays the default watcher address. A custom awHost still needs the
 * Tauri shell — the proxy target is static by design.
 *
 * `tauri dev` also serves the page over http://127.0.0.1:1420 with DEV=true, so
 * the `isTauri()` check is what keeps the native client talking to the watcher
 * directly instead of looping back through the dev server.
 */
function relayForDev(url: string): string {
  if (!import.meta.env.DEV || isTauri()) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (!DEFAULT_HOSTS.includes(parsed.origin)) return url;
    return `${DEV_PROXY}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * ActivityWatch sends no CORS headers, which is the only reason the old build
 * proxied every read through a Node server. Inside Tauri the request is issued
 * by the Rust side, so it is not subject to CORS at all and the browser can
 * talk to the watcher directly.
 *
 * The timeout is raced rather than only aborted: an abort is advisory for the
 * native client, and a hung request must never leave the UI spinning.
 */
export async function httpFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DOMException(`Request timed out after ${TIMEOUT_MS}ms`, "TimeoutError"));
    }, TIMEOUT_MS);
  });

  try {
    const run = isTauri() ? tauriFetch : fetch;
    return await Promise.race([run(relayForDev(url), { ...init, signal: controller.signal }), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
