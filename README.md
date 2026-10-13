# ActivityView

A local analytics dashboard for [ActivityWatch](https://activitywatch.net). It reads the
ActivityWatch REST API and aggregates the raw window / AFK / browser events
into usage statistics, custom categories, a productivity score, behaviour analysis and
long-range trends. Nothing leaves the machine.

## Requirements

- ActivityWatch running locally (default `http://127.0.0.1:5600`), with at least the
  window watcher. The web watcher and AFK watcher add the site ranking and AFK filtering.
- Node.js 20.9+ and pnpm.

## Getting started

```bash
pnpm install

pnpm dev                        # development server
pnpm build && pnpm start        # production build + serve
pnpm lint                       # eslint
```
