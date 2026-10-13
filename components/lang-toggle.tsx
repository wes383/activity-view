"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";

export function LangToggle({ className }: { className?: string }) {
  const { lang, toggleLang } = useLanguage();
  return (
    <Hint label={lang === "zh" ? "English" : "中文"} side="bottom">
      <Button
        size="icon"
        variant="ghost"
        className={className}
        aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}
        onClick={toggleLang}
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Hint>
  );
}
