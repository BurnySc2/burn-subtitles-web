import { describe, expect, it } from "vitest"
import { find_output_node, topo_sort_compose, upstream_of } from "./compose-graph"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { ClipError } from "./mediabunny-clip"

function node(id: string, type: ComposeNode["type"] = "trim"): ComposeNode {
    const position = { x: 0, y: 0 }
    switch (type) {
        case "source":
            return { id, type, position, data: { file: null, probe: null } }
        case "trim":
            return { id, type, position, data: { start: 0, end: 1 } }
        case "transition":
            return { id, type, position, data: { start: 0, duration: 1, easing: "linear" } }
        case "merge":
            return { id, type, position, data: { input_count: 2 } }
        case "subtitles":
            return { id, type, position, data: { file: null, content: null, mode: "mux" } }
        case "output":
            return {
                id,
                type,
                position,
                data: { file_name: null, width: 1280, height: 720, fps: 30, quality: "medium" },
            }
    }
}

function edge(id: string, source: string, target: string): ComposeEdge {
    return { id, source, sourceHandle: null, target, targetHandle: null }
}

describe("topo_sort_compose", () => {
    it("orders a linear chain source to output", () => {
        const nodes = [node("src", "source"), node("trim"), node("out", "output")]
        const edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        expect(topo_sort_compose(nodes, edges)).toEqual(["src", "trim", "out"])
    })

    it("respects diamond dependencies and keeps input order for isolated nodes", () => {
        const nodes = [node("a"), node("b"), node("c"), node("d"), node("solo")]
        const edges = [edge("e1", "a", "b"), edge("e2", "a", "c"), edge("e3", "b", "d"), edge("e4", "c", "d")]
        const order = topo_sort_compose(nodes, edges)
        expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"))
        expect(order.indexOf("a")).toBeLessThan(order.indexOf("c"))
        expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"))
        expect(order.indexOf("c")).toBeLessThan(order.indexOf("d"))
        expect(topo_sort_compose([node("x"), node("y")], [])).toEqual(["x", "y"])
    })

    it("returns an empty order for empty input and ignores unknown endpoints", () => {
        expect(topo_sort_compose([], [])).toEqual([])
        const nodes = [node("a"), node("b")]
        expect(topo_sort_compose(nodes, [edge("e1", "a", "ghost"), edge("e2", "ghost", "b")])).toEqual(["a", "b"])
    })

    it("throws ClipError INVALID_RANGE on cycles and self loops", () => {
        const nodes = [node("a"), node("b")]
        const cycle = [edge("e1", "a", "b"), edge("e2", "b", "a")]
        try {
            topo_sort_compose(nodes, cycle)
            expect.unreachable()
        } catch (error) {
            expect(error).toBeInstanceOf(ClipError)
            expect((error as ClipError).code).toBe("INVALID_RANGE")
        }
        expect(() => topo_sort_compose([node("a")], [edge("e1", "a", "a")])).toThrow(ClipError)
    })
})

describe("find_output_node", () => {
    it("returns the output node and null when absent", () => {
        const nodes = [node("src", "source"), node("out", "output")]
        expect(find_output_node(nodes)?.id).toBe("out")
        expect(find_output_node([node("src", "source")])).toBeNull()
        expect(find_output_node([])).toBeNull()
    })

    it("returns the first output node when several exist", () => {
        const nodes = [node("o1", "output"), node("o2", "output")]
        expect(find_output_node(nodes)?.id).toBe("o1")
    })
})

describe("upstream_of", () => {
    it("returns ancestors in topological order", () => {
        const nodes = [node("src", "source"), node("trim"), node("sub", "subtitles"), node("out", "output")]
        const edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out"), edge("e3", "sub", "out")]
        expect(upstream_of("out", nodes, edges)).toEqual(["src", "sub", "trim"])
        expect(upstream_of("trim", nodes, edges)).toEqual(["src"])
    })

    it("returns empty for sources, unknown targets, and excludes downstream nodes", () => {
        const nodes = [node("a"), node("b"), node("c")]
        const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")]
        expect(upstream_of("a", nodes, edges)).toEqual([])
        expect(upstream_of("ghost", nodes, edges)).toEqual([])
        expect(upstream_of("b", nodes, edges)).toEqual(["a"])
    })
})
