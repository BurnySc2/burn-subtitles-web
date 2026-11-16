import { describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import { create_default_text_item } from "$lib/media/compose-types"
import ComposeTextNode from "./ComposeTextNode.svelte"

vi.mock("@xyflow/svelte", () => ({
    Handle: () => null,
    Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}))

function node_root(screen: { container: HTMLElement }): HTMLElement {
    return screen.container.querySelector('[data-testid="compose-node"]') as HTMLElement
}

describe("ComposeTextNode", () => {
    it("shows the empty hint with an invalid border when there are no items", async () => {
        const screen = await render(ComposeTextNode, { data: { items: [] } })
        const root = node_root(screen)
        expect(root.classList.contains("w-64")).toBe(true)
        expect(root.classList.contains("border-red-400")).toBe(true)
        expect(screen.container.querySelectorAll("li")).toHaveLength(0)
        expect(screen.container.textContent).toMatch(/Empty — add item in inspector\./)
        expect(screen.container.textContent).not.toMatch(/Rename/)
    })

    it("renders one row with text title and dims only below full opacity", async () => {
        const dimmed = await render(ComposeTextNode, {
            data: {
                items: [
                    {
                        ...create_default_text_item(),
                        text: "Hello world",
                        color: "#ff0000",
                        opacity: 0.5,
                        anchor: "top-left",
                    },
                ],
            },
        })
        expect(dimmed.container.querySelectorAll("li")).toHaveLength(1)
        expect(dimmed.container.querySelector("li")?.classList.contains("opacity-50")).toBe(true)
        expect(dimmed.container.querySelector('span[title="Hello world"]')).not.toBeNull()
        expect(dimmed.container.querySelector('span[title="#ff0000"]')).not.toBeNull()
        expect(dimmed.container.querySelector('span[title="top-left"]')?.textContent).toBe("top-left")
        expect(dimmed.container.textContent).not.toMatch(/Rename/)

        const full = await render(ComposeTextNode, {
            data: { items: [{ ...create_default_text_item(), opacity: 1 }] },
        })
        expect(full.container.querySelectorAll("li")).toHaveLength(1)
        expect(full.container.querySelector("li")?.classList.contains("opacity-50")).toBe(false)
        expect(node_root(full).classList.contains("border-red-400")).toBe(false)
    })

    it("caps three items at two rows with an overflow line and dims only the faded row", async () => {
        const screen = await render(ComposeTextNode, {
            data: {
                items: [
                    { ...create_default_text_item(), text: "First", opacity: 1 },
                    { ...create_default_text_item(), text: "Second", opacity: 0.4 },
                    { ...create_default_text_item(), text: "Third", opacity: 1 },
                ],
            },
        })
        const rows = [...screen.container.querySelectorAll("li")]
        expect(rows).toHaveLength(2)
        expect(rows[0]?.classList.contains("opacity-50")).toBe(false)
        expect(rows[1]?.classList.contains("opacity-50")).toBe(true)
        expect(screen.container.textContent).toMatch(/\+1 more/)
        expect(screen.container.textContent).not.toMatch(/Third/)
    })
})
