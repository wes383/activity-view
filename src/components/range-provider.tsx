"use client";

import * as React from "react";
import { dateKey, type RangeKey } from "@/lib/core/time";

const STORAGE_KEY = "activity-view-range";

export interface RangeState {
  key: RangeKey;
  /** Local "YYYY-MM-DD" bounds, only used when key is "custom". */
  from: string;
  to: string;
}

interface RangeContextValue extends RangeState {
  setKey: (key: RangeKey) => void;
  setCustom: (from: string, to: string) => void;
  /** Query string appended to analytics endpoints, e.g. "?range=week". */
  query: string;
}

const RangeContext = React.createContext<RangeContextValue | null>(null);

/**
 * Deliberately free of `new Date()`: the prerender evaluates this, and Cache
 * Components rejects a current-time read in a Client Component. The real
 * "today" is filled in by the hydration layout effect below.
 */
function defaults(): RangeState {
  return { key: "today", from: "", to: "" };
}

export function RangeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<RangeState>(defaults);

  React.useLayoutEffect(() => {
    const today = dateKey(new Date());
    let next: RangeState = { key: "today", from: today, to: today };
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as RangeState | null;
      if (stored && typeof stored.key === "string") next = { ...next, ...stored };
    } catch {
      /* storage unavailable */
    }
    if (!next.from || !next.to) next = { ...next, from: today, to: today };
    // One-time restore of the persisted range before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(next);
  }, []);

  const update = React.useCallback((next: RangeState) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = React.useMemo<RangeContextValue>(() => {
    const query =
      state.key === "custom"
        ? `range=custom&from=${state.from}&to=${state.to}`
        : `range=${state.key}`;
    return {
      ...state,
      query,
      setKey: (key) => update({ ...state, key }),
      setCustom: (from, to) => update({ ...state, key: "custom", from, to: to < from ? from : to }),
    };
  }, [state, update]);

  return <RangeContext.Provider value={value}>{children}</RangeContext.Provider>;
}

export function useRange(): RangeContextValue {
  const ctx = React.useContext(RangeContext);
  if (!ctx) throw new Error("useRange must be used inside <RangeProvider>");
  return ctx;
}
