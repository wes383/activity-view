# ActivityView

A local analytics dashboard for [ActivityWatch](https://activitywatch.net). It reads the
ActivityWatch REST API and aggregates the raw window / AFK / browser events
into usage statistics, custom categories, a productivity score, behaviour analysis and
long-range trends. Nothing leaves the machine.

It ships as a Tauri 2 desktop app: the UI is a plain Vite + React SPA, and every
ActivityWatch request is issued by the Rust side.

## Requirements

- ActivityWatch running locally (default `http://127.0.0.1:5600`), with at least the
  window watcher. The web watcher and AFK watcher add the site ranking and AFK filtering.
- Node.js 22+ and pnpm, for the frontend build.
- A Rust toolchain (stable) for the Tauri shell.
- Windows: WebView2, preinstalled on Windows 10/11.

## Getting started

```bash
pnpm install

pnpm app:dev                    # run the desktop app with hot reload
pnpm app:build                  # produce an installer in src-tauri/target/release/bundle
```

## License

MIT