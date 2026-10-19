import { ThemeProvider } from "next-themes";
import { HashRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { LanguageProvider } from "@/components/language-provider";
import { RangeProvider } from "@/components/range-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import CategoriesPage from "@/pages/categories";
import OverviewPage from "@/pages/overview";
import PrivacyPage from "@/pages/privacy";
import SettingsPage from "@/pages/settings";
import TimelinePage from "@/pages/timeline";
import TrendsPage from "@/pages/trends";

/**
 * Hash routing, not history routing: the packaged app is served from a custom
 * protocol with no server behind it, so a reload on `/categories` would 404.
 */
export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        <LanguageProvider>
          <HashRouter>
            <RangeProvider>
              <AppShell>
                <Routes>
                  <Route path="/" element={<OverviewPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/timeline" element={<TimelinePage />} />
                  <Route path="/trends" element={<TrendsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                </Routes>
              </AppShell>
            </RangeProvider>
          </HashRouter>
        </LanguageProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
