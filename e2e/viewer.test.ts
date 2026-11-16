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
