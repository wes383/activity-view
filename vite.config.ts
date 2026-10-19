import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Mirrors the old Next.js `@/*` path, so no component import had to change.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Tauri owns the terminal in `tauri dev`; clearing it would hide Rust output.
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
    // Only used by `pnpm dev` in a browser: the watcher sends no CORS headers,
    // so UI work outside the Tauri shell needs the dev server to relay. The
    // packaged app skips this entirely — see lib/client/http.ts.
    proxy: {
      "/__aw": {
        target: "http://127.0.0.1:5600",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__aw/, ""),
      },
    },
  },
  build: {
    // WebView2 on Windows and WebKit on macOS both clear this floor.
    target: "chrome110",
    outDir: "dist",
    emptyOutDir: true,
  },
});
