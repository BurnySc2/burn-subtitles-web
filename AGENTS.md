# Burn Subtitles Website

Quick reference for AI agents working on this project.

## Project Overview

A SvelteKit-based web application for burning subtitles into videos using FFmpeg in the browser (WebAssembly). Allows users to upload video and subtitle files, customize styling, and download the processed video with burned-in subtitles.

## Tech Stack

| Technology | Version |
|------------|---------|
| **Framework** | SvelteKit 2.x with Svelte 5 (runes syntax) |
| **Language** | TypeScript 5.x (strict mode) |
| **Styling** | TailwindCSS 4.x + custom CSS |
| **Linting/Formatting** | Biome 2.x |
| **Testing** | Vitest 4.x (unit) + Playwright (e2e) |
| **Video Processing** | @ffmpeg/ffmpeg 0.12.x (WebAssembly) |

### Additional Dependencies

- **@ffmpeg/util** (^0.12.2): Utility functions for FFmpeg WASM
- **JSZip** (^3.10.1): ZIP file handling for ODS extraction
- **Zod** (^4.3.6): Schema validation for type-safe data structures

## Key Features

- Video file upload and processing (MP4, WebM, MKV, AVI, MOV)
- Subtitle file support (SRT, ASS/SSA formats)
- Font customization for subtitles (custom uploads + included fonts)
- Subtitle preview with frame-by-frame rendering
- Browser-based FFmpeg processing (no server required)
- Download processed video or extract SRT from ODS
- Iframe integration with auto-resize to parent

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/                          # Reusable UI components
│   │   │   ├── Spinner.svelte
│   │   │   ├── SubtitleOutput.svelte
│   │   │   ├── SubtitleSettings.svelte
│   │   │   ├── SubtitleUpload.svelte
│   │   │   ├── SubtitleFramePreview.svelte
│   │   │   └── ExtractSrtFromOds.svelte
│   │   ├── ASSSubtitleProcessor.svelte   # Main subtitle processor
│   │   ├── FontPreview.svelte           # Font selection preview
│   │   └── Navigation.svelte            # Site navigation
│   ├── utils/
│   │   ├── video-processing.ts          # FFmpeg processing logic
│   │   ├── subtitle-processing.ts        # Subtitle parsing/conversion
│   │   ├── fonts.ts                      # Font handling
│   │   ├── format_time.ts               # Time formatting utilities
│   │   └── utils.ts                     # General utilities
│   ├── persistent-storage.svelte.ts     # localStorage state
│   ├── temporary-storage.svelte.ts       # Session-only state
│   └── assets/
│       └── favicon.svg
├── routes/
│   ├── +layout.svelte                   # Global layout
│   ├── +layout.ts                       # Layout configuration (static prerender)
│   ├── +page.svelte                     # Main page (redirects to /ass)
│   ├── ass/+page.svelte                 # ASS subtitle processing (main feature)
│   ├── dev/+page.svelte                 # Development testing page
│   ├── download-srt/+page.svelte        # Extract SRT from ODS
│   └── page.svelte.spec.ts              # Unit tests
├── app.css                              # Global styles
├── app.html                             # HTML template
└── app.d.ts                             # Type declarations
static/
├── fonts/                               # Included fonts (TTF files)
├── ffmpeg-core.js                       # FFmpeg WASM core
└── ffmpeg-core.wasm                     # FFmpeg WASM binary
e2e/
└── demo.test.ts                         # End-to-end tests
```

## Routes

| Path | Description |
|------|-------------|
| `/` | Main page - redirects to `/ass` |
| `/ass` | ASS/SSA subtitle format processor (main feature) |
| `/dev` | Development testing page for FFmpeg |
| `/download-srt` | Download extracted SRT from ODS files |

## Code Standards

### Svelte 5 Runes Syntax

Use Svelte 5 runes exclusively (`$state`, `$derived`, `$props`, `$effect`, `$bindable`).

```svelte
<script lang="ts">
    let count = $state(0);
    let doubled = $derived(count * 2);
    
    type Props = { adjective?: 'happy' | 'sad' };
    let { adjective = 'happy' }: Props = $props();
    
    $effect(() => {
        setup();
        return cleanup;
    });
</script>
```

### Event Handlers

Use `onclick` instead of `on:click`. Call `preventDefault()` inside the handler.

```svelte
<button onclick={(e) => { e.preventDefault(); handleClick(); }}>
```

### TypeScript

- Strict mode enabled
- Use `type` over `interface` for simple types
- Enable `checkJs` for JavaScript files

### Biome Configuration

- **Indent**: 4 spaces
- **Line width**: 120 characters
- **Quotes**: Double for JSX, as-needed for properties
- **Semicolons**: As-needed
- Svelte overrides: disable `useConst`, `useImportType`, `noUnusedVariables`, `noUnusedImports`

### Naming Conventions

- **Variables/Functions**: `snake_case` (e.g., `my_variable`, `handle_click`)
- **Components**: PascalCase (e.g., `MyComponent.svelte`)
- **Types/Interfaces**: PascalCase (e.g., `TodoItem`, `FilterType`)
- **Constants**: `SCREAMING_SNAKE_CASE` or `snake_case`
- **CSS Classes**: kebab-case (e.g., `bg-blue-600`, `text-gray-800`)
- **Props/Callbacks**: `snake_case` (e.g., `on_click`, `item_id`)

### Imports

- Use `$lib` alias for internal imports: `import { x } from "$lib/components/x"`
- Use `$app/environment` for browser detection: `import { browser } from "$app/environment"`
- Use `$app/state` for SvelteKit 5 page state: `import { page } from "$app/state"`
- Organize imports: external first, then internal

### Testing Conventions

- Test files: `*.spec.ts` (co-located with source)
- Use `vitest-browser-svelte` for component testing (Playwright-powered)
- Use `page.getByRole()`, `page.getByText()`, `page.getByPlaceholder()` for selectors
- Prefer `await expect.element().toBeInTheDocument()` pattern

## Development Commands

```bash
npm run dev          # Start dev server (port 8000, host 0.0.0.0)
npm run build        # Production build (static adapter)
npm run preview      # Preview production build
npm run check        # Type check + Svelte check
npm run check:watch  # Watch mode for type checking
npm run lint-format  # Run Biome lint + format
npm run test         # Run unit + e2e tests
npm run test:unit    # Unit tests only (Vitest)
npm run test:e2e     # E2E tests only (Playwright)
```

## State Management

The app uses two state management patterns:

| State | File | Persistence | Contents |
|-------|------|-------------|----------|
| `perma_state` | `persistent-storage.svelte.ts` | `localStorage` | Font preferences, custom fonts, last used settings |
| `temp_state` | `temporary-storage.svelte.ts` | Session only | UI selection, form inputs, video/subtitle file state |

Import and use in components:

```typescript
import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
```

## FFmpeg Integration

The project uses `@ffmpeg/ffmpeg` (WebAssembly) for client-side video processing:

```typescript
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

// Initialize FFmpeg
const ffmpeg = new FFmpeg()
await ffmpeg.load({
    coreURL: "/ffmpeg-core.js",
    wasmURL: "/ffmpeg-core.wasm",
})
```

## Included Fonts

The following fonts are bundled in `static/fonts/`:

- Arial.ttf, Tahoma.ttf, Candara.ttf
- NotoSans.ttf (with JP, KR, TC, Thai, Arabic variants)
- NotoKufiArabic.ttf, Lateef.ttf, Cairo.ttf (Arabic)
- OpenSans.ttf, Roboto.ttf, Rubik.ttf
- MaruBuri.ttf (Korean)
- VazirmatnRegular.ttf, VazirmatnBold.ttf (Persian)
- Tajawal.ttf (Arabic)

## External Dependencies

This project may connect to a backend API. Update types with:

```bash
npx openapi-typescript http://localhost:8000/schema/openapi.json --output src/lib/types/api.ts
```

## Build Output

Production builds go to `build/` directory (static adapter with fallback to 404.html).

## Deployment

| Branch | URL |
|--------|-----|
| master | https://subtitles.burnysc2.xyz |
| develop | https://burn-subtitles-dev.netlify.app |
