import { beforeEach, describe, expect, it, vi } from "vitest"
import { clear_node_preview_cache, get_node_preview_blob } from "./compose-preview"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { render_rescale } from "./mediabunny-rescale"
import { render_solid_color } from "./mediabunny-solid"

vi.mock("./mediabunny-solid", () => ({ render_solid_color: vi.fn() }))

vi.mock("./mediabunny-rescale", () => ({ render_rescale: vi.fn() }))

const solid = vi.mocked(render_solid_color)
const rescale = vi.mocked(render_rescale)

function color_node(id = "c"): ComposeNode {
    return { id, type: "color", position: { x: 0, y: 0 }, data: { color: "#112233", duration: 2 } }
}

function rescale_node(id = "r", width = 640): ComposeNode {
    return { id, type: "rescale", position: { x: 0, y: 0 }, data: { width, height: 360, fps: null, fit: "contain" } }
}

function output_node(id = "out", width = 1280): ComposeNode {
    return {
        id,
        type: "output",
        position: { x: 0, y: 0 },
        data: { file_name: null, width, height: 720, fps: 30, quality: "medium" },
    }
}

function edge(id: string, from: string, to: string): ComposeEdge {
    return { id, source: from, sourceHandle: null, target: to, targetHandle: null }
}

beforeEach(() => {
    clear_node_preview_cache()
    solid.mockReset()
    rescale.mockReset()
    solid.mockImplementation(async () => new Blob(["solid"], { type: "video/mp4" }))
    rescale.mockImplementation(async () => new Blob(["scaled"], { type: "video/mp4" }))
})

describe("compose-preview color and rescale", () => {
    it("hits the memo on a repeated color preview", async () => {
        const nodes = [color_node(), output_node()]
        const first = await get_node_preview_blob("c", nodes, [])
        const second = await get_node_preview_blob("c", nodes, [])
        expect(first).toBe(second)
        expect(solid).toHaveBeenCalledTimes(1)
    })

    it("misses the cache when the output width changes", async () => {
        const first = await get_node_preview_blob("c", [color_node(), output_node("out", 1280)], [])
        const second = await get_node_preview_blob("c", [color_node(), output_node("out", 640)], [])
        expect(solid).toHaveBeenCalledTimes(2)
        expect(second).not.toBe(first)
    })

    it("forwards the color blob into rescale through single input", async () => {
        const color_blob = new Blob(["color-frame"], { type: "video/mp4" })
        const scaled_blob = new Blob(["scaled-frame"], { type: "video/mp4" })
        solid.mockResolvedValue(color_blob)
        rescale.mockResolvedValue(scaled_blob)
        const nodes = [color_node(), rescale_node(), output_node()]
        const result = await get_node_preview_blob("r", nodes, [edge("e1", "c", "r")])
        expect(result).toBe(scaled_blob)
        expect(solid).toHaveBeenCalledTimes(1)
        expect(rescale).toHaveBeenCalledTimes(1)
        expect(rescale.mock.calls[0]?.[0]).toBe(color_blob)
    })
})
