"use client";

import * as React from "react";
import { dict, localeOf, type Dict, type Lang } from "@/lib/i18n";

const STORAGE_KEY = "activity-view-lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  toggleLang: () => void;
  /** Active dictionary. Components read `d.nav.overview` rather than string keys. */
  d: Dict;
  locale: string;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Both the server and the first client render use "zh", so nothing mismatches;
  // the stored choice is applied in the layout effect below, before paint.
  const [lang, setLangState] = React.useState<Lang>("zh");

  const apply = React.useCallback((next: Lang) => {
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  }, []);

  React.useLayoutEffect(() => {
    let stored: Lang | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "zh" || raw === "en") stored = raw;
    } catch {
      /* storage unavailable */
    }
    if (stored) {
      // One-time restore of the persisted preference; layout timing applies it
      // before paint so the language never flashes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(stored);
      apply(stored);
    }
  }, [apply]);

  const setLang = React.useCallback(
    (next: Lang) => {
      setLangState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable */
      }
      apply(next);
    },
    [apply]
  );

  const value = React.useMemo<LanguageContextValue>(
    () => ({ lang, setLang, toggleLang: () => setLang(lang === "zh" ? "en" : "zh"), d: dict[lang], locale: localeOf[lang] }),
    [lang, setLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}
