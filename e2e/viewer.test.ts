import { expect, test } from "@playwright/test"

test.skip(({ browserName }) => browserName !== "chromium", "Chromium only")

test("viewer nav and heading are visible", async ({ page }) => {
    await page.goto("/viewer")
    await expect(page.getByRole("link", { name: "Viewer" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Frame Viewer" })).toBeVisible()
})

test("viewer empty state shows picker, hides stage, keyboard is a no-op", async ({ page }) => {
    await page.goto("/viewer")
    await expect(page.locator(".drop-zone")).toBeVisible()
    // ComposeFileDrop exposes choose_aria ("Choose viewer media") as the
    // accessible name, with choose_label ("Choose file") as visible text.
    await expect(page.getByRole("button", { name: /Choose/ })).toBeVisible()
    await expect(page.getByText(/No file chosen/)).toBeVisible()
    // No source: no stage media and no transport controls rendered.
    await expect(page.locator("video, audio")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Play" })).toHaveCount(0)
    // Keyboard shortcut with no source must not crash the page.
    await page.keyboard.press("f")
    await expect(page.getByRole("heading", { name: "Frame Viewer" })).toBeVisible()
})

test("replace file swaps source without reload, remove returns to empty", async ({ page }) => {
    await page.goto("/viewer")
    const picker = page.locator('input[type="file"][accept*="video"]')
    // WHY synthetic bytes: repo has no video fixture (e2e/fixtures,
    // static/* media, test-assets all absent — static/ holds fonts only),
    // and the Accepted status + stage render before probing, so fake bytes
    // exercise the Replace/Remove contract without decode flake.
    await picker.setInputFiles({
        name: "clip-a.mp4",
        mimeType: "video/mp4",
        buffer: Buffer.from("fake-video-bytes-a"),
    })
    await expect(page.getByText("✓ Accepted: clip-a.mp4")).toBeVisible()
    await expect(page.getByRole("button", { name: "Replace viewer media" })).toBeVisible()
    await expect(page.locator("video, audio")).toHaveCount(1)

    await picker.setInputFiles({
        name: "clip-b.mp4",
        mimeType: "video/mp4",
        buffer: Buffer.from("fake-video-bytes-b"),
    })
    await expect(page.getByText("✓ Accepted: clip-b.mp4")).toBeVisible()
    await expect(page.locator("video, audio")).toHaveCount(1)

    await page.getByRole("button", { name: /Remove viewer file/ }).click()
    await expect(page.getByText(/No file chosen/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Choose viewer media" })).toBeVisible()
    await expect(page.locator("video, audio")).toHaveCount(0)
})
