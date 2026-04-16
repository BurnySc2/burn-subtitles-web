import { expect, test } from "@playwright/test"

test("placeholder", async ({ page }) => {
    await page.goto("/")
    await expect(page).toBeDefined()
})
