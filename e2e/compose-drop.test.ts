import { expect, type Page, test } from "@playwright/test"

test.skip(({ browserName }) => browserName !== "chromium", "Chromium only")

async function open_compose(page: Page): Promise<void> {
    await page.goto("/compose?deterministic=1")
    await expect(page.locator(".svelte-flow")).toBeVisible()
}

async function add_node(page: Page, kind: string): Promise<void> {
    await page.getByTestId("compose-palette-select").selectOption(kind)
    await page.getByTestId("compose-palette-add").click()
}

async function install_url_spies(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const scope = window as unknown as { __created: string[]; __revoked: string[] }
        scope.__created = []
        scope.__revoked = []
        const orig_create = URL.createObjectURL.bind(URL)
        const orig_revoke = URL.revokeObjectURL.bind(URL)
        URL.createObjectURL = ((obj: Blob | MediaSource) => {
            const url = orig_create(obj as Blob)
            scope.__created.push(url)
            return url
        }) as typeof URL.createObjectURL
        URL.revokeObjectURL = ((url: string) => {
            scope.__revoked.push(url)
            orig_revoke(url)
        }) as typeof URL.revokeObjectURL
    })
}

async function url_calls(page: Page): Promise<{ created: string[]; revoked: string[] }> {
    return page.evaluate(() => {
        const scope = window as unknown as { __created: string[]; __revoked: string[] }
        return { created: [...scope.__created], revoked: [...scope.__revoked] }
    })
}

// WHY synthetic drop: Playwright has no file-drop API, so build an inline
// File + DataTransfer and dispatch a bubbling DragEvent on the target.
async function drop_file(page: Page, selector: string, name: string, mime: string, content: string): Promise<void> {
    await page.evaluate(
        ({ selector, name, mime, content }) => {
            const target = document.querySelector(selector)
            if (!target) {
                throw new Error(`missing drop target: ${selector}`)
            }
            const file = new File([content], name, { type: mime })
            const transfer = new DataTransfer()
            transfer.items.add(file)
            target.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }))
        },
        { selector, name, mime, content },
    )
}

const SOURCE_DROP = '[data-testid="compose-node"][data-kind="source"] .drop-zone'

test("drop zone is nodrag and canvas drop does not hijack file drop", async ({ page }) => {
    await open_compose(page)
    await add_node(page, "source")
    const source = page.locator('[data-testid="compose-node"][data-kind="source"]')
    await expect(source).toHaveCount(1)
    await expect(source.locator(".drop-zone")).toHaveClass(/nodrag/)
    // Rejected canvas-level drop leaves the graph and validation unchanged.
    await drop_file(page, ".svelte-flow", "notes.txt", "text/plain", "hello")
    await expect(page.locator('[data-testid="compose-node"]')).toHaveCount(1)
    await expect(page.locator(".svelte-flow__edge")).toHaveCount(0)
    await expect(source.getByText("No file selected")).toBeVisible()
})

test("remove revokes the preview URL", async ({ page }) => {
    await install_url_spies(page)
    await open_compose(page)
    await add_node(page, "source")
    await drop_file(page, SOURCE_DROP, "clip.mp4", "video/mp4", "fake-video-bytes")
    const source = page.locator('[data-testid="compose-node"][data-kind="source"]')
    await expect(source.getByRole("button", { name: /Remove source file/ })).toBeVisible()
    const before = await url_calls(page)
    expect(before.created.length).toBeGreaterThanOrEqual(1)
    const created = before.created[0]
    await source.getByRole("button", { name: /Remove source file/ }).click()
    await expect(source.getByText("No file selected")).toBeVisible()
    const after = await url_calls(page)
    expect(after.revoked).toContain(created)
})

test("invalid drop surfaces error status and never probes", async ({ page }) => {
    await install_url_spies(page)
    await open_compose(page)
    await add_node(page, "source")
    await drop_file(page, SOURCE_DROP, "notes.txt", "text/plain", "hello")
    const source = page.locator('[data-testid="compose-node"][data-kind="source"]')
    await expect(source.getByText("Unsupported source file: notes.txt")).toBeVisible()
    const calls = await url_calls(page)
    expect(calls.created).toHaveLength(0)
    await expect(source.getByRole("button", { name: /Remove source file/ })).toBeHidden()
})
