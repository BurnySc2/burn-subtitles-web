import { describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import Navigation from "./Navigation.svelte"

vi.mock("$app/paths", () => ({ resolve: (path: string) => path }))
vi.mock("$app/state", () => ({ page: { url: new URL("http://localhost/clip") } }))

describe("Navigation", () => {
    it("renders a single Clip Extractor link to /clip", async () => {
        const screen = await render(Navigation)
        const links = [...screen.container.querySelectorAll("a")].filter(
            (link) => link.textContent?.trim() === "Clip Extractor",
        )
        expect(links.length).toBe(1)
        expect(links[0]?.getAttribute("href")).toBe("/clip")
    })

    it("never links to /transition", async () => {
        const screen = await render(Navigation)
        const hrefs = [...screen.container.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "")
        expect(hrefs.some((href) => href.includes("transition"))).toBe(false)
    })

    it("never links to /clip-v2", async () => {
        const screen = await render(Navigation)
        const hrefs = [...screen.container.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "")
        expect(hrefs.some((href) => href.includes("clip-v2"))).toBe(false)
    })

    it("marks the active link bold", async () => {
        const screen = await render(Navigation)
        const by_text = (want: string) =>
            [...screen.container.querySelectorAll("a")].find((link) => link.textContent?.trim() === want)
        expect(by_text("Clip Extractor")?.classList.contains("font-bold")).toBe(true)
        expect(by_text("Subtitles Burner")?.classList.contains("font-bold")).toBe(false)
    })
})
