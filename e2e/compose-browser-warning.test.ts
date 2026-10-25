import { expect, type Page, test } from "@playwright/test"

const FIREFOX_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"

async function open_compose(page: Page): Promise<void> {
    await page.goto("/compose?deterministic=1")
    await expect(page.locator(".svelte-flow")).toBeVisible()
}

test("chromium sees no browser warning", async ({ page }) => {
    await open_compose(page)
    await expect(page.locator('[role="alert"]')).toBeHidden()
})

test("non-chromium UA sees dismissible warning persisted in localStorage", async ({ browser }) => {
    const context = await browser.newContext({ userAgent: FIREFOX_UA })
    await context.addInitScript(() => {
        try {
            Object.defineProperty(navigator, "userAgentData", {
                value: undefined,
                configurable: true,
            })
        } catch {
            /* ignore */
        }
    })
    const page = await context.newPage()
    try {
        await open_compose(page)
        const alert = page.locator('[role="alert"]')
        await expect(alert).toBeVisible()
        await expect(alert).toContainText("Chromium")
        await page.getByRole("button", { name: "Dismiss browser warning" }).click()
        await expect(alert).toBeHidden()
        const stored = await page.evaluate(() => localStorage.getItem("compose-browser-warning-dismissed"))
        expect(stored).toBe("1")
        await page.reload()
        await expect(page.locator(".svelte-flow")).toBeVisible()
        await expect(page.locator('[role="alert"]')).toBeHidden()
    } finally {
        await context.close()
    }
})

test("prerendered HTML contains no alert", async ({ request }) => {
    const response = await request.get("/compose?deterministic=1")
    expect(response.ok()).toBe(true)
    const html = await response.text()
    expect(html).not.toContain('role="alert"')
})
