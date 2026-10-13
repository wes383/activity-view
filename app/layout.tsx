import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { AppShell } from "@/components/app-shell";
import { LanguageProvider } from "@/components/language-provider";
import { RangeProvider } from "@/components/range-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "ActivityView",
  description:
    "Local ActivityWatch analytics: usage stats, categories, productivity score, timeline and trends.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#101010" },
  ],
};

/** Fetched by the browser, not at build time, so `next dev` never needs the
 *  network — globals.css lists a system fallback for every family. */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            <LanguageProvider>
              <RangeProvider>
                <AppShell>{children}</AppShell>
              </RangeProvider>
            </LanguageProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
