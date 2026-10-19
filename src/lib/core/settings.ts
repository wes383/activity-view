export type RuleField = "app" | "title" | "domain" | "any";

export interface RuleCondition {
  field: RuleField;
  /** Substring (case-insensitive) unless `regex` is set. */
  pattern: string;
  regex?: boolean;
}

export interface Category {
  id: string;
  label: { zh: string; en: string };
  /** 0 = pure leisure, 1 = fully productive. Drives the productivity score. */
  weight: number;
  /** Index into the 19-color chart palette (1-19). */
  color: number;
  enabled: boolean;
  conditions: RuleCondition[];
}

export interface Settings {
  awHost: string;
  /** null = use the hostname reported by the ActivityWatch server. */
  hostname: string | null;
  excludeAfk: boolean;
  /** Ignore activity events shorter than this many seconds. */
  minEventSec: number;
  /** Same-app events separated by less than this are treated as one continuous stretch. */
  gapToleranceSec: number;
  /** An idle gap at least this long counts as a break. */
  breakThresholdSec: number;
  /** Shortest activity block that counts as a focus session. */
  sessionMinSec: number;
  /** Productivity score at or above this marks time as "work" rather than "leisure". */
  productiveThreshold: number;
  /** Weight applied to time that matches no category. */
  uncategorizedWeight: number;
  categories: Category[];
}

const cat = (
  id: string,
  zh: string,
  en: string,
  weight: number,
  color: number,
  conditions: RuleCondition[]
): Category => ({ id, label: { zh, en }, weight, color, enabled: true, conditions });

export const DEFAULT_CATEGORIES: Category[] = [
  cat("development", "编程开发", "Development", 0.95, 1, [
    { field: "app", pattern: "^(Code|Cursor|Qoder|WorkBuddy|Trae|Cline|idea64|pycharm|webstorm|clion|goland|devecostudio|hveditor|QtCreator|rider|Datagrip|RStudio|Sublime Text|Notepad\\+\\+|vim|nvim)", regex: true },
    { field: "app", pattern: "^(WindowsTerminal|wt|powershell|cmd|bash|zsh|node|git|claude|fnm)", regex: true },
    { field: "title", pattern: "\\.tsx?$|\\.(js|ts|py|go|rs|java|sql|json|md)\\b", regex: true },
    { field: "domain", pattern: "github.com" },
    { field: "domain", pattern: "gitlab.com" },
    { field: "domain", pattern: "localhost" },
    { field: "domain", pattern: "agent.minimax.io" },
  ]),
  cat("work", "工作办公", "Work", 0.85, 2, [
    { field: "app", pattern: "^(DingTalk|Feishu|WPS|wps|winword|excel|powerpnt|onenote|OUTLOOK|Teams|Zoom|wemeetapp|Slack)", regex: true },
    { field: "domain", pattern: "feishu.cn" },
    { field: "domain", pattern: "docs.qq.com" },
    { field: "domain", pattern: "notion.so" },
    { field: "domain", pattern: "slack.com" },
    { field: "domain", pattern: "jira.atlassian" },
    { field: "app", pattern: "orkest-todo" },
    { field: "app", pattern: "Notion" },
  ]),
  cat("ai", "AI 助手", "AI assistants", 0.7, 9, [
    { field: "app", pattern: "^(ChatGPT|Claude|Doubao|Kimi|Poe)", regex: true },
    { field: "title", pattern: "gpt|grok|claude|gemini|copilot|deepseek|qwen|kimi|doubao|muse", regex: true },
    { field: "domain", pattern: "openai.com" },
    { field: "domain", pattern: "chatgpt.com" },
    { field: "domain", pattern: "grok.com" },
    { field: "domain", pattern: "claude.ai" },
    { field: "domain", pattern: "gemini.google.com" },
    { field: "domain", pattern: "muse.ai" },
    { field: "domain", pattern: "deepseek.com" },
    { field: "domain", pattern: "kimi.com" },
    { field: "domain", pattern: "doubao.com" },
    { field: "domain", pattern: "www.qianwen.com" },
    { field: "app", pattern: "Cue" },
    { field: "domain", pattern: "agentmore.chatglm.cn" },
  ]),
  cat("learning", "学习阅读", "Learning", 0.7, 4, [
    { field: "app", pattern: "^(AcroRD32|AcroBAT|SumatraPDF|Foxit|Zotero|Calibre)", regex: true },
    { field: "title", pattern: "docs\\.|documentation|tutorial|course|教程|手册|课程", regex: true },
    { field: "domain", pattern: "docs.activitywatch.net" },
    { field: "domain", pattern: "developer.mozilla.org" },
    { field: "domain", pattern: "stackoverflow.com" },
    { field: "domain", pattern: "runoob.com" },
    { field: "domain", pattern: "coursera.org" },
    { field: "domain", pattern: "wikipedia.org" },
  ]),
  cat("social", "社交媒体", "Social media", 0.25, 7, [
    { field: "app", pattern: "^(WeChat|Weixin|QQ|Telegram)", regex: true },
    { field: "title", pattern: "weibo|twitter|facebook|instagram|reddit|zhihu|linkedin|douyin|telegram", regex: true },
    { field: "domain", pattern: "weibo.com" },
    { field: "domain", pattern: "x.com" },
    { field: "domain", pattern: "twitter.com" },
    { field: "domain", pattern: "facebook.com" },
    { field: "domain", pattern: "instagram.com" },
    { field: "domain", pattern: "reddit.com" },
    { field: "domain", pattern: "zhihu.com" },
    { field: "domain", pattern: "linkedin.com" },
    { field: "domain", pattern: "douyin.com" },
  ]),
  cat("entertainment", "休闲娱乐", "Entertainment", 0.1, 3, [
    { field: "app", pattern: "^(steam|Spotify|cloudmusic|PotPlayer|mpv|vlc|EpicGames|Launcher)", regex: true },
    { field: "title", pattern: "bilibili|哔哩哔哩|youtube|netflix|twitch|steam|douyin|豆瓣|douban", regex: true },
    { field: "domain", pattern: "bilibili.com" },
    { field: "domain", pattern: "youtube.com" },
    { field: "domain", pattern: "youtu.be" },
    { field: "domain", pattern: "netflix.com" },
    { field: "domain", pattern: "twitch.tv" },
    { field: "domain", pattern: "steampowered.com" },
    { field: "domain", pattern: "music.163.com" },
    { field: "domain", pattern: "douban.com" },
    { field: "app", pattern: "PikPak" },
    { field: "app", pattern: "Vishel" },
    { field: "app", pattern: "sinking_star" },
    { field: "app", pattern: "MuMuNxDevice" },
  ]),
  cat("browsing", "网页浏览", "Browsing", 0.5, 10, [
    { field: "app", pattern: "^(chrome|msedge|firefox|brave|opera|iexplorer)", regex: true },
    { field: "domain", pattern: "newtab" },
  ]),
  cat("system", "系统工具", "System", 0.5, 16, [
    { field: "app", pattern: "^(Explorer|SearchApp|Taskmgr|TextInputHost|ApplicationFrameHost|SystemSettings|SearchHost|StartMenu)", regex: true },
    { field: "app", pattern: "clash-verge" },
  ]),
];

/** Overridable at build time; the watcher listens on loopback by default. */
const DEFAULT_AW_HOST =
  (import.meta.env.VITE_ACTIVITYWATCH_HOST as string | undefined) ?? "http://127.0.0.1:5600";

export const DEFAULT_SETTINGS: Settings = {
  awHost: DEFAULT_AW_HOST,
  hostname: null,
  excludeAfk: true,
  minEventSec: 0,
  gapToleranceSec: 30,
  breakThresholdSec: 300,
  sessionMinSec: 900,
  productiveThreshold: 0.5,
  uncategorizedWeight: 0.5,
  categories: DEFAULT_CATEGORIES,
};

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeCategory(input: unknown, index: number): Category | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const label = (raw.label ?? {}) as Record<string, unknown>;
  const conditions = Array.isArray(raw.conditions) ? raw.conditions : [];
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `category-${index}`,
    label: {
      zh: typeof label.zh === "string" && label.zh.trim() ? label.zh.trim() : `分类 ${index + 1}`,
      en: typeof label.en === "string" && label.en.trim() ? label.en.trim() : `Category ${index + 1}`,
    },
    weight: num(raw.weight, 0.5, 0, 1),
    color: Math.round(num(raw.color, (index % 19) + 1, 1, 19)),
    enabled: raw.enabled !== false,
    conditions: conditions
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({
        field: (["app", "title", "domain", "any"].includes(String(c.field)) ? String(c.field) : "any") as RuleField,
        pattern: typeof c.pattern === "string" ? c.pattern : "",
        regex: c.regex === true,
      }))
      .filter((c) => c.pattern.length > 0 && c.pattern.length <= 200),
  };
}

/** Clamps every field back into range, so a hand-edited file can never crash the UI. */
export function sanitizeSettings(input: unknown): Settings {
  const raw = (input ?? {}) as Record<string, unknown>;
  const categories = Array.isArray(raw.categories)
    ? raw.categories.map(sanitizeCategory).filter((c): c is Category => c !== null)
    : DEFAULT_CATEGORIES;

  const host = typeof raw.awHost === "string" ? raw.awHost.trim() : DEFAULT_SETTINGS.awHost;
  return {
    awHost: /^https?:\/\//.test(host) ? host.replace(/\/+$/, "") : DEFAULT_SETTINGS.awHost,
    hostname: typeof raw.hostname === "string" && raw.hostname.trim() ? raw.hostname.trim() : null,
    excludeAfk: raw.excludeAfk !== false,
    minEventSec: num(raw.minEventSec, DEFAULT_SETTINGS.minEventSec, 0, 600),
    gapToleranceSec: num(raw.gapToleranceSec, DEFAULT_SETTINGS.gapToleranceSec, 0, 600),
    breakThresholdSec: num(raw.breakThresholdSec, DEFAULT_SETTINGS.breakThresholdSec, 30, 7200),
    sessionMinSec: num(raw.sessionMinSec, DEFAULT_SETTINGS.sessionMinSec, 60, 7200),
    productiveThreshold: num(raw.productiveThreshold, DEFAULT_SETTINGS.productiveThreshold, 0, 1),
    uncategorizedWeight: num(raw.uncategorizedWeight, DEFAULT_SETTINGS.uncategorizedWeight, 0, 1),
    categories: categories.length > 0 ? categories : DEFAULT_CATEGORIES,
  };
}
