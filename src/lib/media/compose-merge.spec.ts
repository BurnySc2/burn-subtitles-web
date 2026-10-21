import { beforeEach, describe, expect, it, vi } from "vitest"
import { execute_compose_graph } from "./compose-executor"
import { ordered_merge_inputs } from "./compose-graph"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { validate_compose } from "./compose-validation"
import { render_merge } from "./mediabunny-merge"

vi.mock("./mediabunny-merge", () => ({ render_merge: vi.fn() }))

vi.mock("./mediabunny-clip", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-clip")>()
    return { ...actual, extract_clip: vi.fn() }
})

vi.mock("./mediabunny-transition", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-transition")>()
    return { ...actual, render_transition: vi.fn() }
})

const mp4_blob = (text: string): Blob => new Blob([text], { type: "video/mp4" })

const mp4_file = (name: string): File => new File([`${name}-bytes`], name, { type: "video/mp4" })

function source(id: string): ComposeNode {
    return { id, type: "source", position: { x: 0, y: 0 }, data: { file: mp4_file(`${id}.mp4`), probe: null } }
}

function merge(id: string, input_count = 2): ComposeNode {
    return { id, type: "merge", position: { x: 0, y: 0 }, data: { input_count } }
}

function output(id = "out"): ComposeNode {
    return {
        id,
        type: "output",
        position: { x: 0, y: 0 },
        data: { file_name: null, width: 1280, height: 720, fps: 30, quality: "medium" },
    }
}

function edge(id: string, from: string, to: string, targetHandle: string | null = null): ComposeEdge {
    return { id, source: from, sourceHandle: null, target: to, targetHandle }
}

describe("ordered_merge_inputs", () => {
    it("sorts in0 first regardless of edge order", () => {
        const edges = [edge("e1", "b", "m", "in1"), edge("e2", "a", "m", "in0"), edge("e3", "c", "m", "in2")]
        expect(ordered_merge_inputs("m", edges)).toEqual(["a", "b", "c"])
    })

    it("ignores edges for other targets", () => {
        const edges = [edge("e1", "a", "m", "in0"), edge("e2", "b", "other", "in0")]
        expect(ordered_merge_inputs("m", edges)).toEqual(["a"])
    })
})

describe("validate_compose merge", () => {
    it("accepts two ordered inputs", () => {
        const nodes = [source("a"), source("b"), merge("m"), output()]
        const edges = [edge("e1", "a", "m", "in0"), edge("e2", "b", "m", "in1"), edge("e3", "m", "out")]
        expect(validate_compose(nodes, edges)).toEqual([])
    })

    it("flags fewer than 2 inputs", () => {
        const nodes = [source("a"), merge("m"), output()]
        const edges = [edge("e1", "a", "m", "in0"), edge("e2", "m", "out")]
        expect(validate_compose(nodes, edges)).toContainEqual({
            node_id: "m",
            field: "input",
            message: "Merge node must have at least 2 inputs",
        })
    })

    it("flags non-in handles and duplicates", () => {
        const bad_handle = [source("a"), source("b"), merge("m"), output()]
        const bad_edges = [edge("e1", "a", "m", "a"), edge("e2", "b", "m", "in1"), edge("e3", "m", "out")]
        expect(validate_compose(bad_handle, bad_edges)).toContainEqual({
            node_id: "m",
            field: "input",
            message: 'Merge node inputs must be "in0", "in1", ...',
        })
        const dup = [source("a"), source("b"), merge("m"), output()]
        const dup_edges = [edge("e1", "a", "m", "in0"), edge("e2", "b", "m", "in0"), edge("e3", "m", "out")]
        expect(validate_compose(dup, dup_edges)).toContainEqual({
            node_id: "m",
            field: "input",
            message: "Merge node inputs must use distinct handles",
        })
    })

    it("flags handles outside input_count", () => {
        const nodes = [source("a"), source("b"), merge("m", 2), output()]
        const edges = [edge("e1", "a", "m", "in0"), edge("e2", "b", "m", "in5"), edge("e3", "m", "out")]
        expect(validate_compose(nodes, edges).some((issue) => issue.message.includes("outside input_count"))).toBe(true)
    })
})

describe("execute_compose_graph merge", () => {
    beforeEach(() => {
        vi.mocked(render_merge).mockReset()
        vi.mocked(render_merge).mockImplementation(async () => ({
            blob: mp4_blob("merged"),
            extension: "mp4",
            mime: "video/mp4",
            cancel: () => Promise.resolve(),
        }))
    })

    it("renders inputs in in0 order with output dims fallback", async () => {
        const result = await execute_compose_graph({
            nodes: [source("a"), source("b"), merge("m"), output()],
            edges: [edge("e1", "b", "m", "in1"), edge("e2", "a", "m", "in0"), edge("e3", "m", "out")],
        })
        expect(result.ok).toBe(true)
        const call = vi.mocked(render_merge).mock.calls[0]?.[0]
        expect(call?.files.map((file) => file.name)).toEqual(["a.mp4", "b.mp4"])
        expect(call?.width).toBe(1280)
        expect(call?.height).toBe(720)
        expect(call?.fps).toBe(30)
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })
})
