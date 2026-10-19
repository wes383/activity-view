import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import "@/globals.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container");

/**
 * The right-click menu here is the WebView's own browser menu — Back, Reload, Save
 * as, Print, Inspect — none of which belongs in a desktop window. Editable fields
 * are exempt: Undo / Cut / Copy / Paste there is a real feature, and the browser's
 * menu is the only one available without building our own.
 *
 * Listened to in the capture phase so a component that stops propagation cannot
 * quietly bring the menu back.
 */
function suppressNativeContextMenu() {
  document.addEventListener(
    "contextmenu",
    (event) => {
      const target = event.target;
      const editable =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (!editable) event.preventDefault();
    },
    true
  );
}

suppressNativeContextMenu();

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
