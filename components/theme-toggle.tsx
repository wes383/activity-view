"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/components/language-provider";
import { useMounted } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const ORDER: ThemeChoice[] = ["light", "dark", "system"];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { d } = useLanguage();
  const mounted = useMounted();

  const current: ThemeChoice = mounted && ORDER.includes(theme as ThemeChoice) ? (theme as ThemeChoice) : "system";
  const Icon = !mounted || current === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;
  const label: Record<ThemeChoice, string> = {
    light: d.theme.light,
    dark: d.theme.dark,
    system: d.theme.system,
  };
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  return (
    <Hint label={`${label[current]} → ${label[next]}`} side="bottom">
      <Button
        size="icon"
        variant="ghost"
        aria-label={label[current]}
        className={cn(className)}
        onClick={() => setTheme(next)}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Hint>
  );
}
