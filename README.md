# Burn Subtitles Website

Master branch deployment: https://subtitles.burnysc2.xyz

Develop branch deployment: https://burn-subtitles-dev.netlify.app

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
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Update typescript types

There may be a problem keeping the types up to date with the backend api.

While backend is running under, you can run

```sh
npx openapi-typescript http://localhost:8000/schema/openapi.json --output src/lib/types/api.ts
```

to update the types of the endpoints.

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
