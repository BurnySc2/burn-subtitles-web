# AGENTS.md — AI Agent Quick Overview

Static, client-only SvelteKit frontend. No backend, no server routes, no database.
All media work (subtitle burn-in, SRT extract) runs in-browser via
FFmpeg WASM, and clip trimming via MediaBunny + WebCodecs.

## Stack

- SvelteKit 2 + Svelte 5 (runes), `adapter-static`, `prerender = true` (`src/routes/+layout.ts`)
- Tailwind CSS v4 (`@tailwindcss/vite`), tokens + `.btn`/`.section`/`.drop-zone` in `src/app.css`
- Media: `mediabunny ^1.61.6` + `@mediabunny/{aac,flac,mp3}-encoder`, `@ffmpeg/{ffmpeg,util} ^0.12`
- Quality: Biome (format+lint), `svelte-check`, vitest browser + Playwright (`vitest-browser-svelte`)

## Routes

| Route | File | Purpose |
|---|---|---|
| `/` | `src/routes/+page.svelte` | Subtitle burn-in (FFmpeg), preview + render |
| `/clip` | `src/routes/clip/+page.svelte` | Clip Extractor via MediaBunny, no FFmpeg |
| `/ass` | `src/routes/ass/+page.svelte` | ASS subtitle tooling |
| `/download-srt` | `src/routes/download-srt/+page.svelte` | SRT download helper |
| `/dev` | `src/routes/dev/+page.svelte` | Dev-only scratch page |

## Key files

| Path | Role |
|---|---|
| `src/lib/media/mediabunny-clip.ts` | `probe_media()` + `extract_clip()` (mp4/mp3/wav), `ClipError` codes |
| `src/lib/media/clip-v2-state.svelte.ts` | `$state` singleton for v2, `reset_output()` / `revoke_all()` |
| `src/lib/media/timecode.ts` | `parse_timecode` (`mm:ss.mmm`, `hh:mm:ss.mmm`), `format_timecode`, `clamp_timecode` |
| `src/lib/temporary-storage.svelte.ts` | `$state` singleton for FFmpeg/extract flows |
| `src/lib/persistent-storage.svelte.ts` | Persisted settings store |
| `src/lib/utils/format_time.ts` | Legacy `hh:mm:ss` helpers |
| `src/lib/utils/video-processing.ts`, `video-metadata.ts`, `subtitle-processing.ts` | Burn-in render, metadata, SRT parse |
| `src/lib/components/feature/clip-v2/{ClipV2Extractor,MediaPreview,TimeInputs}.svelte` | Clip Extractor UI |
| `src/lib/components/feature/subtitle/*` | Upload/extract/output subtitle components |
| `svelte.config.js` / `src/routes/+layout.ts` | `adapter-static` + global `prerender = true` |

## Conventions

- `snake_case` for vars/functions/state fields; `PascalCase` for components, types, classes (`ClipError`, `ProbeResult`).
- Svelte 5 runes only: `$state` / `$derived`, `onclick=` (not `on:click`); shared state = module-level `$state` singletons, not stores.
- Styling via `app.css` helpers (`.btn .btn-primary/.btn-secondary .btn-sm/.btn-md/.btn-lg`, `.section`, `.form-label`, `.drop-zone`); Tailwind utilities for layout.
- Code, identifiers, comments in English.
- `await import("mediabunny")` dynamically (never top-level) — SSR/prerender safety; v2 path must never import `@ffmpeg`.
- Object URLs: `URL.revokeObjectURL()` old URL before replacing; `onDestroy` revokes previews/sources (`SubtitleUpload`, `ClipV2Extractor`, root page).
- FFmpeg MEMFS: `writeFile` → `exec` → `readFile` → `deleteFile` input+output.
- Biome: 4-space indent, 120 cols, `semicolons: asNeeded`, `useBlockStatements: error`.

## Commands

```sh
npm run dev                # vite dev on :8000 --host 0.0.0.0
npm run check              # svelte-kit sync + svelte-check
npm run lint               # biome check . --error-on-warnings
npm run test:unit          # vitest run (browser/chromium, src/**/*.spec|test.ts)
npm run test:integration   # playwright test
```

## Verification

- `npm run check` → 0 errors; `npm run lint` clean (note: preview `<video>` elements may trip Biome a11y `useMediaCaption` — verify before suppressing).
- Keep `package.json` + lockfile in sync when touching deps (`generate-types` targets a local backend that is not part of this repo).

## Gotchas

- `adapter-static` + `strict: true`: every route must prerender; no server code, no load-time network fetch (runtime `fetch` in event handlers, e.g. font loading, is fine).
- MediaBunny needs Secure Context (HTTPS/localhost) + WebCodecs; `computeFrameRateMetrics()` (`mediabunny-clip.ts:120`) is expensive — probe path only, failures fall back to `null`.
- `optimizeDeps.exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"]` in `vite.config.ts` — do not remove.
- Large-file flows hold Blobs + object URLs in memory; always revoke on reset/replace/unmount.
