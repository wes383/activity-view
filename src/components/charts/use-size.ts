"use client";

import * as React from "react";

/** Measures a container so SVG charts can be drawn at true pixel width. */
export function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = React.useRef<T | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentRect;
      setSize((prev) =>
        Math.abs(prev.width - box.width) < 1 && Math.abs(prev.height - box.height) < 1 ? prev : { width: box.width, height: box.height }
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
