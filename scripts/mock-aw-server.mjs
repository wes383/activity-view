// Dependency-free mock of the ActivityWatch v0 REST API, for UI testing only.
//
//   node scripts/mock-aw-server.mjs          # listens on 127.0.0.1:5601
//   MOCK_AW_PORT=5699 node scripts/mock-aw-server.mjs
//
// Then set Settings → ActivityWatch host to http://127.0.0.1:5601, and switch it
// back once you are done. Nothing here touches the real aw-server or its database.

import http from "node:http";

const PORT = Number(process.env.MOCK_AW_PORT ?? 5601);
const HOSTNAME = "MOCK-PC";
const VERSION = "0.14.1-mock";
const HISTORY_DAYS = 400;

const created = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
const nowStamp = () => new Date().toISOString();

const BUCKETS = {
  [`${HOSTNAME}_mock-watcher-window_currentwindow`]: {
    id: `${HOSTNAME}_mock-watcher-window_currentwindow`,
    type: "currentwindow",
    client: "mock-watcher-window",
    hostname: HOSTNAME,
    created,
    last_updated: nowStamp(),
    data: {},
  },
  [`${HOSTNAME}_mock-watcher-afk_afkstatus`]: {
    id: `${HOSTNAME}_mock-watcher-afk_afkstatus`,
    type: "afkstatus",
    client: "mock-watcher-afk",
    hostname: HOSTNAME,
    created,
    last_updated: nowStamp(),
    data: {},
  },
  [`${HOSTNAME}_mock-web-chrome_web.tab.current`]: {
    id: `${HOSTNAME}_mock-web-chrome_web.tab.current`,
    type: "web.tab.current",
    client: "mock-web-chrome",
    hostname: HOSTNAME,
    created,
    last_updated: nowStamp(),
    data: {},
  },
};

const CODE_TITLES = [
  "activity-view — app/categories/page.tsx",
  "activity-view — lib/core/categories.ts",
  "mock-service — scripts/mock-aw-server.mjs",
  "auth-gateway — src/token.rs",
  "无标题工作区",
];
const DOCS_TITLES = ["周报-10月.docx", "需求评审纪要", "预算表.xlsx", "项目排期 · Notion"];
const CHAT_TITLES = ["微信", "Slack · #platform", "钉钉 · 产品群"];
const SITES = [
  ["github.com", "Pull requests · mock/service"],
  ["stackoverflow.com", "How to clip intervals in TypeScript"],
  ["developer.mozilla.org", "Array.prototype.reduce()"],
  ["sqlite.org", "BEGIN TRANSACTION"],
  ["caniuse.com", "css :has() support"],
  ["chatgpt.com", "新聊天"],
  ["claude.ai", "Artifacts · 区间代数"],
  ["copilot.microsoft.com", "Bing"],
  ["youtube.com", "Rust async internals — 24 min"],
  ["bilibili.com", "【演示】城市夜景观光"],
  ["netflix.com", "怪奇物语 S04E03"],
  ["news.ycombinator.com", "Hacker News"],
  ["twitter.com", "Home / X"],
  ["weibo.com", "微博 - 首页"],
  ["reddit.com", "r/programming"],
  ["legacy-intranet.example", "内网旧系统 · 工单"],
  ["old-bookmarks.test", "收藏夹归档"],
  ["random-legacy-tools.example", "工具站"],
];
const LEISURE_SITES = new Set(["youtube.com", "bilibili.com", "netflix.com", "twitter.com", "weibo.com", "reddit.com"]);

const MYSTERY_APPS = [
  ["TurboDesk.exe", "TurboDesk 远程桌面"],
  ["WidgetLab.exe", "WidgetLab — 未命名工程"],
  ["pixel-canvas", "Pixel Canvas 画板"],
  ["OldLauncher.exe", "旧启动器 v0.3"],
];

function hash(text) {
  let h = 2166136_261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 1_677_761_9);
  }
  return h >>> 0;
}

function rng(seedText) {
  let a = hash(seedText);
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick(list, random) {
  return list[Math.floor(random() * list.length) % list.length];
}

function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const planCache = new Map();

/**
 * A deterministic day of activity: coding/文档 blocks on weekdays, more leisure on
 * weekends, a couple of AFK gaps, plus a few apps and hosts no default rule
 * matches so the 未分类 quick-assign flow has something to chew on.
 */
function dayPlan(key) {
  const cached = planCache.get(key);
  if (cached) return cached;

  const random = rng(`v1:${key}`);
  const anchor = new Date(`${key}T00:00:00`);
  const weekday = anchor.getDay() !== 0 && anchor.getDay() !== 6;
  const off = 252_000;

  const windowEvents = [];
  const afkEvents = [];
  const webEvents = [];

  const isToday = key === dayKey(Date.now());
  const limit = isToday ? Date.now() - off : anchor.getTime() + 86_400_000 - off;

  let cursor = anchor.getTime() + (weekday ? 8 * 3_600_000 : 10 * 3_600_000) + Math.floor(random() * 50) * 60_000;
  let lastWindow = null;
  const stop = Math.min(
    limit,
    anchor.getTime() + (weekday ? 18 + random() * 3 : 15 + random() * 5) * 3_600_000
  );

  while (cursor < stop) {
    const kindRoll = random();
    let app;
    let title = null;
    let site = null;

    if (weekday && kindRoll < 0.34) {
      app = "Code.exe";
      title = pick(CODE_TITLES, random);
    } else if (weekday && kindRoll < 0.5) {
      app = "chrome.exe";
      site = pick(SITES, random);
      title = site[1];
    } else if (weekday && kindRoll < 0.6) {
      app = pick(["WINWORD.EXE", "EXCEL.EXE", "idea64.exe", "TableGen.exe"], random);
      title = pick(DOCS_TITLES, random);
    } else if (kindRoll < 0.68) {
      app = pick(["Weixin.exe", "Slack.exe", "DingTalk.exe"], random);
      title = pick(CHAT_TITLES, random);
    } else if (kindRoll < 0.78) {
      app = "chrome.exe";
      site = pick([...SITES].filter((s) => LEISURE_SITES.has(s[0])), random);
      title = site[1];
    } else if (kindRoll < 0.85) {
      app = pick(["Spotify.exe", "Steam.exe", "MusicBee.exe"], random);
      title = pick(["播放列表 · 深夜代码", "Steam 库", "Lo-Fi 电台"], random);
    } else if (kindRoll < 0.93) {
      app = pick(["explorer.exe", "Taskmgr.exe", "Settings.exe", "ApplicationFrameHost.exe"], random);
      title = pick(["文件资源管理器", "任务管理器", "设置", "开始菜单"], random);
    } else {
      const mystery = pick(MYSTERY_APPS, random);
      app = mystery[0];
      title = mystery[1];
    }

    const duration = (60 + Math.floor(random() * 17) * 60 + Math.floor(random() * 60)) * 1000;
    const end = Math.min(cursor + duration, stop);
    if (end - cursor < 30_000) break;

    windowEvents.push({ timestamp: new Date(cursor).toISOString(), duration: (end - cursor) / 1000, data: { app, title } });
    lastWindow = { app, title };
    lastWindow = { app, title };
    if (site) {
      webEvents.push({
        timestamp: new Date(cursor).toISOString(),
        duration: (end - cursor) / 1000,
        data: { url: `https://${site[0]}/`, title: site[1], domain: site[0], browser: "chrome" },
      });
    }

    cursor = end;

    if (random() < 0.22) {
      const gap = (2 + Math.floor(random() * 26)) * 60_000;
      const afkEnd = Math.min(cursor + gap, stop);
      afkEvents.push({ timestamp: new Date(cursor).toISOString(), duration: (afkEnd - cursor) / 1000, data: { status: "afk" } });
      afkEvents.push({ timestamp: new Date(afkEnd).toISOString(), duration: 5, data: { status: "not-afk" } });
      // The real window watcher keeps reporting the same window while idle, so the
      // AFK interval overlaps it and 排除 AFK actually has something to subtract.
      if (lastWindow) {
        windowEvents.push({
          timestamp: new Date(cursor).toISOString(),
          duration: (afkEnd - cursor) / 1000,
          data: { app: lastWindow.app, title: lastWindow.title },
        });
      }
      cursor = afkEnd + 5000;
    }

    if (random() < 0.12) {
      const nap = (35 + Math.floor(random() * 55)) * 60_000;
      const napEnd = Math.min(cursor + nap, stop);
      afkEvents.push({ timestamp: new Date(cursor).toISOString(), duration: (napEnd - cursor) / 1000, data: { status: "afk" } });
      if (lastWindow) {
        windowEvents.push({
          timestamp: new Date(cursor).toISOString(),
          duration: (napEnd - cursor) / 1000,
          data: { app: lastWindow.app, title: lastWindow.title },
        });
      }
      cursor = napEnd;
    }
  }

  // A live-ish tail so the status card does not look stale today.
  if (isToday && windowEvents.length > 0) {
    const recent = Date.now() - 90_000;
    windowEvents.push({ timestamp: new Date(recent).toISOString(), duration: 20, data: { app: "Code.exe", title: CODE_TITLES[0] } });
    afkEvents.push({ timestamp: new Date(recent).toISOString(), duration: 20, data: { status: "not-afk" } });
  }

  const plan = { window: windowEvents, afk: afkEvents, web: webEvents };
  planCache.set(key, plan);
  return plan;
}

function eventsFor(bucketId, startMs, endMs) {
  const kind = BUCKETS[bucketId]?.type === "afkstatus" ? "afk" : BUCKETS[bucketId]?.type?.startsWith("web.") ? "web" : "window";
  const out = [];
  const firstKey = dayKey(startMs);
  const lastKey = dayKey(endMs);
  if (firstKey === lastKey) {
    collect(dayPlan(firstKey)[kind], startMs, endMs, out);
    return out;
  }
  for (let day = new Date(`${firstKey}T00:00:00`).getTime(); day <= new Date(`${lastKey}T00:00:00`).getTime(); day += 86_400_000) {
    collect(dayPlan(dayKey(day))[kind], startMs, endMs, out);
  }
  return out;
}

function collect(events, startMs, endMs, out) {
  for (const event of events) {
    const from = Date.parse(event.timestamp);
    const to = from + event.duration * 1000;
    if (to > startMs && from < endMs) out.push(event);
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  const path = url.pathname.replace(/\/+$/, "");

  const send = (body, status = 200) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  };

  if (path === "/api/0/info") {
    send({ hostname: HOSTNAME, version: VERSION, testing: true, device_id: "mock-device", profile: "mock" });
    return;
  }

  if (path === "/api/0/buckets") {
    send(BUCKETS);
    return;
  }

  const eventsMatch = path.match(/^\/api\/0\/buckets\/([^/]+)\/events$/);
  if (eventsMatch) {
    const bucketId = decodeURIComponent(eventsMatch[1]);
    if (!BUCKETS[bucketId]) {
      send({ message: "No such bucket" }, 404);
      return;
    }
    const startMs = Date.parse(url.searchParams.get("start") ?? "");
    const endMs = Date.parse(url.searchParams.get("end") ?? "");
    const limit = Number(url.searchParams.get("limit") ?? "-1");
    let list = Number.isFinite(startMs) && Number.isFinite(endMs) ? eventsFor(bucketId, startMs, endMs) : [];
    if (Number.isFinite(limit) && limit > 0) list = list.slice(0, limit);
    send(list);
    return;
  }

  send({ message: "mock: unsupported endpoint", path }, 404);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock ActivityWatch on http://127.0.0.1:${PORT} (hostname ${HOSTNAME}, ${HISTORY_DAYS} days of fake activity)`);
  console.log("Ctrl+C to stop, then set ActivityWatch host back to http://127.0.0.1:5600");
});
