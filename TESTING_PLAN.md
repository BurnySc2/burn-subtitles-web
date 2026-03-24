# Testing Plan: Subtitle Components

## Philosophy

**Test behavior, not implementation.** Focus on what users can do with the components, not internal state or DOM details.

This plan covers component-level tests using `vitest-browser-svelte`. End-to-end flows are covered by Playwright e2e tests.

---

## Components & Behavioral Tests

### 1. FontPreview.svelte
**Location:** `src/lib/components/feature/subtitle/FontPreview.svelte`

**Behaviors:**
- [ ] Displays sample text that user can edit
- [ ] Reset button restores default text

---

### 2. SubtitleUpload.svelte
**Location:** `src/lib/components/feature/subtitle/SubtitleUpload.svelte`

**Behaviors:**
- [ ] User can select a video file
- [ ] User can select a subtitle file (SRT)
- [ ] Upload inputs are disabled while processing

---

### 3. SubtitleSettings.svelte
**Location:** `src/lib/components/feature/subtitle/SubtitleSettings.svelte`

**Behaviors:**
- [ ] Font customization controls are present
- [ ] Color customization controls are present
- [ ] Position controls are present

---

### 4. SubtitleOutput.svelte
**Location:** `src/lib/components/feature/subtitle/SubtitleOutput.svelte`

**Behaviors:**
- [ ] User can download ASS file when subtitle is loaded
- [ ] Processed video is displayed after rendering
- [ ] User can download processed video

---

### 5. SubtitleFramePreview.svelte
**Location:** `src/lib/components/feature/subtitle/SubtitleFramePreview.svelte`

**Behaviors:**
- [ ] Preview section appears when video and subtitle are loaded
- [ ] User can enter timestamp and render preview
- [ ] Preview image displays after rendering

---

### 6. ExtractSrtFromOds.svelte
**Location:** `src/lib/components/feature/subtitle/ExtractSrtFromOds.svelte`

**Behaviors:**
- [ ] User can upload ODS file
- [ ] User can configure extraction (sheet, column, rows)
- [ ] User can download extracted SRT

---

### 7. ASSSubtitleProcessor.svelte
**Location:** `src/lib/components/feature/subtitle/ASSSubtitleProcessor.svelte`

**Behaviors:**
- [ ] Quality mode selector is present
- [ ] Render button is disabled until files are uploaded
- [ ] Progress is shown during rendering
- [ ] Error messages are displayed when something fails

---

## Implementation Notes

### Testing Pattern

```typescript
import { beforeEach, describe, expect, it } from "vitest"
import { page } from "@vitest/browser/context"
import { render } from "vitest-browser-svelte"
import ComponentName from "./ComponentName.svelte"

describe("ComponentName", () => {
    beforeEach(() => {
        localStorage.clear()
        render(ComponentName)
    })

    it("should render", async () => {
        // Test presence of key elements
    })

    it("should allow user to [action]", async () => {
        // Test user interaction
    })
})
```

### Skip If Complex
- File upload interactions (hard to test reliably in browser)
- FFmpeg rendering (requires actual WebAssembly)
- Complex async state transitions

For these, rely on e2e tests instead.

---

## Execution Order

1. `FontPreview.svelte.spec.ts` - Simplest, no dependencies
2. `SubtitleUpload.svelte.spec.ts` - Simple state updates
3. `SubtitleSettings.svelte.spec.ts` - Uses perma_state
4. `SubtitleOutput.svelte.spec.ts` - Depends on temp_state
5. `SubtitleFramePreview.svelte.spec.ts` - Composite component
6. `ExtractSrtFromOds.svelte.spec.ts` - Standalone feature
7. `ASSSubtitleProcessor.svelte.spec.ts` - Main container

---

## What NOT to Test (Covered by E2E)

- Exact color values, slider positions
- Individual form field attributes
- Disabled states during complex workflows
- Progress bar exact values
- Promise/loading state details

---

## Running Tests

```bash
npm run test:unit        # Run all unit tests
npm run test             # Run unit + e2e tests
```
