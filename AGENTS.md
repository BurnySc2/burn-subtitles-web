# Burn Subtitles Website

Quick reference for AI agents working on this project.

## Project Overview

A SvelteKit-based web application for burning subtitles into videos using FFmpeg in the browser (WebAssembly). Allows users to upload video and subtitle files, customize styling, and download the processed video with burned-in subtitles.

## Tech Stack

- **Framework**: SvelteKit 2.x with Svelte 5 (runes syntax)
- **Language**: TypeScript 5.x
- **Styling**: TailwindCSS 4.x + custom CSS
- **Linting/Formatting**: Biome 2.x
- **Testing**: Vitest (unit) + Playwright (e2e)
- **Video Processing**: @ffmpeg/ffmpeg (WebAssembly)
- **UI Components**: bits-ui, Lucide icons

## Key Features

- Video file upload and processing
- Subtitle file support (SRT, ASS formats)
- Font customization for subtitles
- Subtitle preview with frame-by-frame rendering
- Browser-based FFmpeg processing (no server required)
- Download processed video or extracted SRT

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   │   ├── Spinner.svelte
│   │   │   ├── SubtitleOutput.svelte
│   │   │   ├── SubtitleSettings.svelte
│   │   │   ├── SubtitleUpload.svelte
│   │   │   ├── SubtitleFramePreview.svelte
│   │   │   └── ExtractSrtFromOds.svelte
│   │   ├── ASSSubtitleProcessor.svelte
│   │   ├── FontPreview.svelte
│   │   └── Navigation.svelte
│   ├── utils/
│   │   ├── video-processing.ts    # FFmpeg processing logic
│   │   ├── subtitle-processing.ts # Subtitle parsing/conversion
│   │   ├── fonts.ts               # Font handling
│   │   ├── format_time.ts         # Time formatting utilities
│   │   └── utils.ts
│   ├── persistent-storage.svelte.ts
│   └── temporary-storage.svelte.ts
├── routes/
│   ├── +layout.svelte       # Global layout
│   ├── +page.svelte         # Main page (video + subtitle burning)
│   ├── ass/+page.svelte     # ASS subtitle processing
│   ├── dev/+page.svelte     # Development/testing page
│   └── download-srt/+page.svelte
├── app.css                  # Global styles
└── app.html
static/
├── fonts/                   # Included fonts (TTF files)
├── ffmpeg-core.js          # FFmpeg WASM core
└── ffmpeg-core.wasm
```

## Routes

| Path | Description |
|------|-------------|
| `/` | Main page - video upload + subtitle burning |
| `/ass` | ASS/SSA subtitle format processor |
| `/dev` | Development testing page |
| `/download-srt` | Download extracted SRT from ODS |

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

## Development Commands

```bash
npm run dev          # Start dev server (port 8000, host 0.0.0.0)
npm run build        # Production build (static adapter)
npm run preview      # Preview production build
npm run check        # Type check + Svelte check
npm run check:watch  # Watch mode for type checking
npm run lint-format # Run Biome lint + format
npm run test        # Run unit + e2e tests
npm run test:unit   # Unit tests only (Vitest)
npm run test:e2e    # E2E tests only (Playwright)
```

## External Dependencies

This project may connect to a backend API. Update types with:

```bash
npx openapi-typescript http://localhost:8000/schema/openapi.json --output src/lib/types/api.ts
```

## Build Output

Production builds go to `build/` directory (static adapter with fallback to 404.html).

## Deployment

- **Master branch**: https://subtitles.burnysc2.xyz
- **Develop branch**: https://burn-subtitles-dev.netlify.app
