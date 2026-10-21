# Burn Subtitles Website

Master branch deployment: https://subtitles.burnysc2.xyz

Develop branch deployment: https://burn-subtitles-dev.netlify.app

## Features

- Subtitles Burner (`/`): burns styled subtitles into video in the browser.
- Download SRT (`/download-srt`): builds an SRT file from subtitle lines in an ODS sheet.
- Clip Extractor (`/clip`): trims video/audio in the browser, no upload.

> No uploads, no servers — your media stays on this device.

### Clip Extractor usage

1. Open `/clip` and choose a `video/*,audio/*` file.
2. Enter start/end as `mm:ss.mmm` or `hh:mm:ss.mmm`, or press ◉ Now to copy the preview position.
3. Expand the Media details `<details>` block to inspect codecs and format.
4. Press Extract Clip, then Download Clip to save `{base}_{start}-{end}.{ext}`.
5. Output: video → `mp4`; audio with mp3 source → `mp3`, otherwise `flac`. Sizes show dual `MiB · MB`.

## Fonts & Licensing

This project burns subtitles with FFmpeg and supports 16 bundled fonts in `static/fonts/`.

**Code:** MIT (see `LICENSE`)
**Fonts:** 14× SIL Open Font License 1.1 (`Cairo, Lateef, MaruBuri, Noto* (6), Rubik, Tajawal, Vazirmatn (2 weights)`) + 2× Apache License 2.0 (`OpenSans, Roboto`). See `static/fonts/OFL.txt`, `static/fonts/APACHE-2.0.txt` and `static/fonts/FONT_LICENSES.md` for full terms and per-font copyright holders. The MIT license does **not** apply to the font binaries.

**Removed:** `Arial`, `Candara`, `Tahoma` (proprietary Microsoft fonts) were purged from all branches on 2026-08-28 — replaced by metric-compatible OFL alternatives (`Noto Sans`, `Cairo`). If you had `Arial` selected, the app now defaults to `Noto Sans` (clamped automatically for old localStorage).

**Verification:** `npm run check:fonts` validates the allowlist and attribution; CI runs it on every PR.

To try out fonts locally, you can save the fonts to `~/.fonts/` and they will be seen by linux and listed in DaVinci Resolve.


## Developing

Once you've created a project and installed dependencies with `npm install`, start a development server:

```sh
npm run dev # vite dev on :8000 --host 0.0.0.0

# or start the server and open the app in a new browser tab
npm run dev -- --open

npm run check # svelte-kit sync + svelte-check
npm run lint # biome check
npm run test:unit # vitest run (browser/chromium)
npm run test:integration # playwright test
npm run build # production build
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
