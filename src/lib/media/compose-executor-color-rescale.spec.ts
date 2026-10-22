import { beforeEach, describe, expect, it, vi } from "vitest"
import { execute_compose_graph } from "./compose-executor"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { render_rescale } from "./mediabunny-rescale"
import { render_solid_color } from "./mediabunny-solid"

vi.mock("./mediabunny-solid", () => ({ render_solid_color: vi.fn() }))

vi.mock("./mediabunny-rescale", () => ({ render_rescale: vi.fn() }))

const mp4_blob = (text: string): Blob => new Blob([text], { type: "video/mp4" })

function color(id: string, color_value = "#ff0000", duration = 2): ComposeNode {
    return { id, type: "color", position: { x: 0, y: 0 }, data: { color: color_value, duration } }
}

function rescale(id: string): ComposeNode {
    return {
        id,
        type: "rescale",
        position: { x: 0, y: 0 },
        data: { width: 640, height: 360, fps: 24, fit: "contain" },
    }
}

function source(id: string): ComposeNode {
    return {
        id,
        type: "source",
        position: { x: 0, y: 0 },
        data: { file: new File(["bytes"], `${id}.mp4`, { type: "video/mp4" }), probe: null },
    }
}

function output(id = "out"): ComposeNode {
    return {
        id,
        type: "output",
        position: { x: 0, y: 0 },
        data: { file_name: null, width: 320, height: 180, fps: 15, quality: "high" },
    }
}

function edge(id: string, from: string, to: string): ComposeEdge {
    return { id, source: from, sourceHandle: null, target: to, targetHandle: null }
}

beforeEach(() => {
    vi.mocked(render_solid_color).mockReset()
    vi.mocked(render_rescale).mockReset()
    vi.mocked(render_solid_color).mockImplementation(async () => mp4_blob("solid"))
    vi.mocked(render_rescale).mockImplementation(async () => mp4_blob("rescaled"))
})

describe("execute_compose_graph color and rescale", () => {
    it("forwards output dims to render_solid_color", async () => {
        const result = await execute_compose_graph({ nodes: [color("c"), output()], edges: [edge("e1", "c", "out")] })
        expect(result.ok).toBe(true)
        const call = vi.mocked(render_solid_color).mock.calls[0]?.[0]
        expect(call?.width).toBe(320)
        expect(call?.height).toBe(180)
        expect(call?.fps).toBe(15)
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })

    it("forwards node dims and output quality to render_rescale", async () => {
        const result = await execute_compose_graph({
            nodes: [source("src"), rescale("r"), output()],
            edges: [edge("e1", "src", "r"), edge("e2", "r", "out")],
        })
        expect(result.ok).toBe(true)
        const options = vi.mocked(render_rescale).mock.calls[0]?.[1]
        expect(options?.width).toBe(640)
        expect(options?.height).toBe(360)
        expect(options?.fps).toBe(24)
        expect(options?.fit).toBe("contain")
        expect(options?.quality).toBe("high")
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })

    it("short-circuits invalid color with zero mock calls", async () => {
        const result = await execute_compose_graph({
            nodes: [color("c", "not-a-color"), output()],
            edges: [edge("e1", "c", "out")],
        })
        expect(result.ok).toBe(false)
        expect(result.output).toBeNull()
        expect(vi.mocked(render_solid_color)).not.toHaveBeenCalled()
        expect(vi.mocked(render_rescale)).not.toHaveBeenCalled()
    })
})
