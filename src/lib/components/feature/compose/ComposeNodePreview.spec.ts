import { beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import { get_node_preview_blob } from "$lib/media/compose-preview"
import ComposeNodePreview from "./ComposeNodePreview.svelte"

vi.mock("$lib/media/compose-preview", () => ({ get_node_preview_blob: vi.fn() }))

const mocked_preview = vi.mocked(get_node_preview_blob)
let url_count = 0
let revoked: string[] = []

beforeEach(() => {
    mocked_preview.mockReset()
    url_count = 0
    revoked = []
    vi.stubGlobal("URL", {
        createObjectURL: vi.fn(() => `blob:preview-${++url_count}`),
        revokeObjectURL: vi.fn((url: string) => {
            revoked.push(url)
        }),
    })
    mocked_preview.mockImplementation(async () => new Blob(["frame"], { type: "video/mp4" }))
})

describe("ComposeNodePreview", () => {
    it("does not auto-run on mount", async () => {
        const on_preview = vi.fn()
        const screen = await render(ComposeNodePreview, { node_id: "n1", on_preview })
        expect(mocked_preview).not.toHaveBeenCalled()
        expect(screen.container.textContent).toMatch(/Press Preview/)
        expect(on_preview.mock.calls.filter(([preview]) => preview.blob !== null)).toHaveLength(0)
        await screen.unmount()
    })

    it("revokes the old URL on a second preview", async () => {
        const screen = await render(ComposeNodePreview, { node_id: "n1" })
        const button = () => screen.container.querySelector("button") as HTMLButtonElement
        button().click()
        await vi.waitFor(() => expect(screen.container.querySelector("video")).not.toBeNull())
        const first = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.results[0]?.value as string
        button().click()
        await vi.waitFor(() => expect(mocked_preview).toHaveBeenCalledTimes(2))
        await vi.waitFor(() => expect(revoked).toContain(first))
        await screen.unmount()
    })

    it("revokes the current URL on unmount", async () => {
        const screen = await render(ComposeNodePreview, { node_id: "n1" })
        ;(screen.container.querySelector("button") as HTMLButtonElement).click()
        await vi.waitFor(() => expect(screen.container.querySelector("video")).not.toBeNull())
        const current = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value as string
        await screen.unmount()
        expect(revoked).toContain(current)
    })
})
