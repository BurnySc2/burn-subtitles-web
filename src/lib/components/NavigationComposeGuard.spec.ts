import { describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import Navigation from "$lib/components/Navigation.svelte"

vi.mock("$app/paths", () => ({ resolve: (path: string) => path }))
vi.mock("$app/state", () => ({ page: { url: new URL("http://localhost/compose") } }))

describe("Navigation compose guard", () => {
    it("links to /compose and never to /transition", async () => {
        const screen = await render(Navigation)
        const hrefs = [...screen.container.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "")
        expect(hrefs).toContain("/compose")
        expect(hrefs.some((href) => href.includes("transition"))).toBe(false)
        await screen.unmount()
    })
})
