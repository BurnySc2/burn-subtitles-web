import { expect, type Locator, type Page, test } from "@playwright/test"

async function open_compose(page: Page): Promise<void> {
    await page.goto("/compose?deterministic=1")
    await expect(page.locator(".svelte-flow")).toBeVisible()
}

async function add_node(page: Page, kind: string): Promise<void> {
    await page.getByTestId("compose-palette-select").selectOption(kind)
    await page.getByTestId("compose-palette-add").click()
}

async function add_color_trim_output(page: Page): Promise<void> {
    await add_node(page, "color")
    await add_node(page, "trim")
    await add_node(page, "output")
    await expect(page.locator('[data-testid="compose-node"]')).toHaveCount(3)
}

function node_handle(page: Page, kind: string, type: "source" | "target", index = 0): Locator {
    return page
        .locator(`[data-testid="compose-node"][data-kind="${kind}"]`)
        .nth(index)
        .locator(`.svelte-flow__handle.${type}`)
}

// WHY dispatched clicks: ?deterministic=1 staggers nodes by 40px so they overlap,
// and a real mouse click can land on an overlapping node body instead of the handle.
// Dispatching click on the handle still exercises the approved
// handle-click to handle-click path (source click then target click, no drag).
async function connect_handles(page: Page, from: Locator, to: Locator): Promise<void> {
    await from.dispatchEvent("click")
    await page.waitForTimeout(100)
    await to.dispatchEvent("click")
}

test("adds color, trim and output nodes via the palette", async ({ page }) => {
    await open_compose(page)
    await add_color_trim_output(page)
    await expect(page.locator('[data-testid="compose-node"][data-kind="color"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="compose-node"][data-kind="trim"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="compose-node"][data-kind="output"]')).toHaveCount(1)
})

test("connects color to trim to output via handle clicks", async ({ page }) => {
    await open_compose(page)
    await add_color_trim_output(page)
    await connect_handles(page, node_handle(page, "color", "source"), node_handle(page, "trim", "target"))
    await expect(page.locator(".svelte-flow__edge")).toHaveCount(1)
    await connect_handles(page, node_handle(page, "trim", "source"), node_handle(page, "output", "target"))
    await expect(page.locator(".svelte-flow__edge")).toHaveCount(2)
    await expect(page.getByText("✓ Graph valid")).toBeVisible()
})

test("rejects invalid connections without changing the graph", async ({ page }) => {
    await open_compose(page)
    await add_color_trim_output(page)
    await connect_handles(page, node_handle(page, "color", "source"), node_handle(page, "trim", "target"))
    await connect_handles(page, node_handle(page, "trim", "source"), node_handle(page, "output", "target"))
    await expect(page.locator(".svelte-flow__edge")).toHaveCount(2)
    // Second input into trim is rejected: trim accepts exactly 1 input.
    await add_node(page, "color")
    await expect(page.locator('[data-testid="compose-node"][data-kind="color"]')).toHaveCount(2)
    await connect_handles(page, node_handle(page, "color", "source", 1), node_handle(page, "trim", "target"))
    await expect(page.locator(".svelte-flow__edge")).toHaveCount(2)
    // Input into color is rejected: color nodes accept no inputs
    // (strict mode also refuses this source-to-source handle pair).
    await connect_handles(page, node_handle(page, "trim", "source"), node_handle(page, "color", "source", 0))
    await expect(page.locator(".svelte-flow__edge")).toHaveCount(2)
    // Second color node is unconnected so it cannot reach output: issues panel lists it.
    await expect(page.getByText(/does not reach|Issues \(/).first()).toBeVisible()
})
