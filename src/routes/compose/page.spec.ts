import { beforeEach, describe, expect, it } from "vitest"
import { render } from "vitest-browser-svelte"
import { revoke_all } from "$lib/media/compose-state.svelte"
import ComposePage from "./+page.svelte"

beforeEach(() => {
    revoke_all()
})

describe("/compose page smoke", () => {
    it("mounts palette, canvas, inspector, and render bar", async () => {
        const screen = await render(ComposePage)
        expect(screen.container.textContent).toMatch(/Add node/)
        expect(screen.container.querySelector(".compose-canvas")).not.toBeNull()
        expect(screen.container.textContent).toMatch(/Inspector/)
        expect(screen.container.textContent).toMatch(/Render/)
        await screen.unmount()
    })
})
