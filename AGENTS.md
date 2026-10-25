# AGENTS.md — AI Agent Quick Overview

Static, client-only SvelteKit frontend. No backend, no server routes, no database.
Subtitle burn-in (`/`) runs in-browser via FFmpeg WASM; clip trimming (`/clip`)
runs via MediaBunny + WebCodecs — no FFmpeg on the clip path.

## Stack

- SvelteKit 2 + Svelte 5 (runes), `adapter-static`, `prerender = true` (`src/routes/+layout.ts`)
- Tailwind CSS v4 (`@tailwindcss/vite`), tokens + `.btn`/`.section`/`.drop-zone` in `src/app.css`
- Media: `mediabunny ^1.61.6` + `@mediabunny/{aac,flac,mp3}-encoder`, `@ffmpeg/{ffmpeg,util} ^0.12`, `@xyflow/svelte ^1.7.0` (compose canvas only)
- Quality: Biome (format+lint), `svelte-check`, vitest browser + Playwright (`vitest-browser-svelte`)

## Routes

| Route           | File                                   | Purpose                                                                                         |
| --------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/`             | `src/routes/+page.svelte`              | Subtitle burn-in (FFmpeg), preview + render                                                     |
| `/clip`         | `src/routes/clip/+page.svelte`         | Sole Clip Extractor via MediaBunny, no FFmpeg (ex `/clip-v2` moved here)                        |
| `/ass`          | `src/routes/ass/+page.svelte`          | ASS subtitle tooling                                                                            |
| `/download-srt` | `src/routes/download-srt/+page.svelte` | SRT download helper                                                                             |
| `/compose`      | `src/routes/compose/+page.svelte`      | DAG builder: palette → canvas → inspector → render (MediaBunny; FFmpeg only for subtitles burn) |
| `/dev`          | `src/routes/dev/+page.svelte`          | Dev-only scratch page                                                                           |

Deleted v1: `feature/clip/ClipExtractor.svelte`, `lib/utils/clip-processing.ts`,
`routes/clip-v2/` (moved to `/clip`). Nav has one clip link: `Clip Extractor → /clip`.

## Key files

| Path                                                                                                                                                  | Role                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/media/mediabunny-clip.ts`                                                                                                                    | `probe_media()` (split `probe_video_track` / `probe_audio_track` / `probe_decodability`; probe includes `video_color_space`) + `extract_clip()` (`mp4`/`mp3`/`flac`; wav removed), `ClipError` (`UNSUPPORTED`/`CANCELLED`/`INVALID_RANGE`/`FAILED`)                                                                                                                    |
| `src/lib/media/mediabunny-clip.ts`                                                                                                                    | `default_output_kind()`: video→`mp4`; audio keeps `mp3`, else `flac`; mp3/flac encoders registered (`ensure_audio_encoders`)                                                                                                                                                                                                                                           |
| `src/lib/media/clip-v2-state.svelte.ts`                                                                                                               | Collapsed `$state`: `source {file,url,probe}` / `result {url,mime,ext,size_bytes,duration}`; `reset_output()` / `revoke_all()`                                                                                                                                                                                                                                         |
| `src/lib/media/clip-filename.ts`                                                                                                                      | `clip_filename()` → `{base}_{start}-{end}.{ext}`; sanitized, 60-char stem                                                                                                                                                                                                                                                                                              |
| `src/lib/media/timecode.ts`                                                                                                                           | `parse_timecode` (`mm:ss.mmm`, `hh:mm:ss.mmm`), `format_timecode`, `clamp_timecode`, `validate_range`                                                                                                                                                                                                                                                                  |
| `src/lib/utils/format_size.ts`                                                                                                                        | `format_dual_size()` → `x MiB · y MB` (used for source + result sizes)                                                                                                                                                                                                                                                                                                 |
| `src/lib/components/feature/clip-v2/ClipV2Extractor.svelte`                                                                                           | Upload (`video/*,audio/*`, accepted-status line) → preview → times → extract/cancel → result                                                                                                                                                                                                                                                                           |
| `src/lib/components/feature/clip-v2/{MediaPreview,MediaDetails}.svelte`                                                                               | Preview (video/audio) + collapsible media details (codecs, resolution, fps, bitrates, color space)                                                                                                                                                                                                                                                                     |
| `src/lib/components/feature/clip-v2/{TimeInputs,ExtractResult}.svelte`                                                                                | Horizontal start/end inputs with ◉ Now buttons; merged `Clip ready` result + `Download Clip`                                                                                                                                                                                                                                                                           |
| `src/lib/components/feature/compose/ComposeCanvas.svelte`                                                                                             | Flow canvas: dynamic `load_flow()` (`SvelteFlow` + 9 node Hosts), `onconnect` → `add_compose_edge`, `snapGrid [15,15]`, `connectionRadius 28`, `isValidConnection` live preview (`is_valid_preview` mirrors `add_compose_edge` rules, green/red tint); handle styling under `.compose-canvas :global(...)` (12px + `::after` halo); transition `Start` shown on canvas |
| `src/lib/components/feature/compose/nodes/`                                                                                                           | 9 `*Host.svelte` wrappers + 9 `*Node.svelte` views (`source/trim/transition/merge/subtitles/overlay/color/rescale/output`); ports are `<Handle>` + `Position` from `@xyflow/svelte`; source/overlay nodes own `Replace`/`Remove` buttons + `.drop-zone`                                                                                                                |
| `src/lib/media/transition-utils.ts`                                                                                                                   | `TRANSITION_AUDIO_MODES` (9) + `TRANSITION_AUDIO_MODE_HINTS`; `OUTPUT_COLOR_SPACE` + `add_canvas_frame()` (VUI pin bt709/bt709/bt709); inspector `Audio` select; solo-a/solo-b forward `VideoSample`s directly when output dims match (no canvas), blend stays canvas; overlay passthrough when no effective overlay work                                              |
| `src/lib/media/compose-drop.ts`                                                                                                                       | `first_dropped_file()` / `is_accepted()` only; consumers: source node (:141,158), overlay node (:160,177), source picker (:70,87), overlay picker (:94,111); `.drop-zone` style lives in `app.css`                                                                                                                                                                     |
| `src/lib/components/feature/compose/{ComposeSourcePicker,ComposeOverlayPicker}.svelte` + `nodes/ComposeOutputNode.svelte` + `ComposeInspector.svelte` | Pickers own `.drop-zone` + `Remove`; output node + inspector own labels (`File name`, `Audio quality (AAC)`, `CRF override`)                                                                                                                                                                                                                                           |
| `src/lib/media/compose-state.svelte.ts`                                                                                                               | `compose_state` / `compose_view` singletons; `add_compose_edge()` (per-kind input rules, duplicate/self guards) / `remove_compose_nodes()` / `revoke_all()`                                                                                                                                                                                                            |
| `src/lib/media/compose-validation.ts` / `compose-executor.ts`                                                                                         | `validate_compose()` (render gate in `+page.svelte`) / `execute_compose_graph()` (MediaBunny trim/merge/transition/subtitles; FFmpeg only for subtitles `burn` mode)                                                                                                                                                                                                   |
| `src/lib/media/compose-types.ts` / `compose-graph.ts` / `compose-filename.ts`                                                                         | Node/edge types + `compose_node_title()` / graph helpers / `compose_filename()`                                                                                                                                                                                                                                                                                        |
| `src/lib/utils/video-processing.ts`, `video-metadata.ts`, `subtitle-processing.ts`                                                                    | Burn-in render, metadata, SRT parse                                                                                                                                                                                                                                                                                                                                    |
| `src/lib/temporary-storage.svelte.ts` / `persistent-storage.svelte.ts`                                                                                | Ephemeral `$state` singleton (FFmpeg/extract flows) / persisted settings                                                                                                                                                                                                                                                                                               |
| `src/lib/utils/format_time.ts`                                                                                                                        | Legacy `hh:mm:ss` helpers                                                                                                                                                                                                                                                                                                                                              |
| `svelte.config.js` / `src/routes/+layout.ts`                                                                                                          | `adapter-static` (`strict: true`) + global `prerender = true`                                                                                                                                                                                                                                                                                                          |

## Conventions

- `snake_case` for vars/functions/state fields; `PascalCase` for components, types, classes (`ClipError`, `ProbeResult`).
- Svelte 5 runes only: `$state` / `$derived`, `onclick=` (not `on:click`); shared state = module-level `$state` singletons, not stores.
- Styling via `app.css` helpers (`.btn .btn-primary/.btn-secondary .btn-sm/.btn-md/.btn-lg`, `.section`, `.form-label`, `.drop-zone`); Tailwind utilities for layout.
- Code, identifiers, comments in English.
- `await import("mediabunny")` dynamically (never top-level) — SSR/prerender safety; `/clip` path must never import `@ffmpeg`. Same rule for `@xyflow/svelte`: `ComposeCanvas.svelte` loads it in `onMount` via `load_flow()` (static import breaks prerender; type-only imports are fine).
- Compose handles: `<Handle>` ports live in `*Node.svelte` views; all handle CSS under `.compose-canvas :global(...)` in `ComposeCanvas.svelte` (never per-node `<style>`).
- Object URLs: `URL.revokeObjectURL()` old URL before replacing; `onDestroy` revokes previews/sources (`ClipV2Extractor`, root page).
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
- `npm run test:unit`: 34 files, 241 passed (vitest browser/chromium).
- Keep `package.json` + lockfile in sync when touching deps (`generate-types` targets a local backend that is not part of this repo).

## Gotchas

- `adapter-static` + `strict: true`: every route must prerender; no server code, no load-time network fetch (runtime `fetch` in event handlers, e.g. font loading, is fine).
- MediaBunny needs Secure Context (HTTPS/localhost) + WebCodecs; `computeFrameRateMetrics()` (`mediabunny-clip.ts:157-162`) is expensive — probe path only, failures fall back to `null`.
- Clip path works offline after first load (encoders bundled, no runtime CDN); C+D note: copy/download flow stays local, no uploads ever.
- `optimizeDeps.exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"]` in `vite.config.ts` — do not remove; dropping FFmpeg entirely deferred while `/` burn-in uses it.
- Large-file flows hold Blobs + object URLs in memory; always revoke on reset/replace/unmount.
