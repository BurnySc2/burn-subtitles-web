import { describe, expect, it } from "vitest"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { create_default_text_item } from "./compose-types"
import { collect_stack_segments } from "./mediabunny-compose-stack"

const video_file = (name: string): File => new File([`${name}-bytes`], name, { type: "video/mp4" })

const image_file = (name: string): File => new File([`${name}-bytes`], name, { type: "image/png" })

function source(id: string): ComposeNode {
    return { id, type: "source", position: { x: 0, y: 0 }, data: { file: video_file(`${id}.mp4`), probe: null } }
}

function color(id: string, duration = 5): ComposeNode {
    return { id, type: "color", position: { x: 0, y: 0 }, data: { color: "#112233", duration } }
}

function overlay(id: string, show_start = 0, show_end: number | null = null): ComposeNode {
    return {
        id,
        type: "overlay",
        position: { x: 0, y: 0 },
        data: {
            image: image_file(`${id}.png`),
            position: "center",
            scale: 50,
            opacity: 1,
            offset_x: 0,
            offset_y: 0,
            show_start,
            show_end,
        },
    }
}

function text(id: string, show_start = 0, show_end: number | null = null): ComposeNode {
    return {
        id,
        type: "text",
        position: { x: 0, y: 0 },
        data: { items: [{ ...create_default_text_item(), show_start, show_end }] },
    }
}

function rescale(id: string): ComposeNode {
    return {
        id,
        type: "rescale",
        position: { x: 0, y: 0 },
        data: { width: 640, height: 360, fps: null, fit: "contain" },
    }
}

function trim(id: string): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start: 1, end: 2 } }
}

function transition(id: string): ComposeNode {
    return {
        id,
        type: "transition",
        position: { x: 0, y: 0 },
        data: { start: 0, duration: 1, easing: "linear" },
    }
}

function merge(id: string): ComposeNode {
    return { id, type: "merge", position: { x: 0, y: 0 }, data: { input_count: 2 } }
}

function subtitles(id: string, mode: "mux" | "sidecar" | "burn"): ComposeNode {
    return {
        id,
        type: "subtitles",
        position: { x: 0, y: 0 },
        data: { file: null, content: "1\n00:00:01,000 --> 00:00:02,000\nHi\n", mode },
    }
}

function output(id = "out"): ComposeNode {
    return {
        id,
        type: "output",
        position: { x: 0, y: 0 },
        data: { file_name: null, width: 640, height: 360, fps: 30, quality: "medium" },
    }
}

function edge(id: string, from: string, to: string, targetHandle: string | null = null): ComposeEdge {
    return { id, source: from, sourceHandle: null, target: to, targetHandle }
}

describe("collect_stack_segments", () => {
    it("collects an overlay/text tail with a terminal rescale", () => {
        const nodes = [source("s"), overlay("o"), text("x"), rescale("r"), output()]
        const edges = [edge("e1", "s", "o"), edge("e2", "o", "x"), edge("e3", "x", "r"), edge("e4", "r", "out")]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].head_id).toBe("s")
        expect(segments[0].node_ids).toEqual(["s", "o", "x", "r", "out"])
        expect(segments[0].terminal_rescale_id).toBe("r")
        expect(segments[0].fast_path).toBe(false)
    })

    it("treats a rescale before the output as terminal but splits at a mid-chain rescale", () => {
        const nodes = [source("s"), rescale("mid"), overlay("o"), rescale("term"), output()]
        const edges = [
            edge("e1", "s", "mid"),
            edge("e2", "mid", "o"),
            edge("e3", "o", "term"),
            edge("e4", "term", "out"),
        ]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].terminal_rescale_id).toBe("term")
        expect(segments[0].head_id).toBeNull()
        expect(segments[0].node_ids).toEqual(["o", "term", "out"])
    })

    it("collects a solid-color head with zero inputs", () => {
        const nodes = [color("c"), overlay("o"), output()]
        const edges = [edge("e1", "c", "o"), edge("e2", "o", "out")]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].head_id).toBe("c")
        expect(segments[0].terminal_rescale_id).toBeNull()
        expect(segments[0].node_ids).toEqual(["c", "o", "out"])
    })

    it("splits at a trim barrier", () => {
        const nodes = [source("s"), trim("t"), overlay("o"), output()]
        const edges = [edge("e1", "s", "t"), edge("e2", "t", "o"), edge("e3", "o", "out")]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].head_id).toBeNull()
        expect(segments[0].node_ids).toEqual(["o", "out"])
    })

    it("splits at a merge barrier", () => {
        const nodes = [source("a"), source("b"), merge("m"), overlay("o"), output()]
        const edges = [
            edge("e1", "a", "m", "in0"),
            edge("e2", "b", "m", "in1"),
            edge("e3", "m", "o"),
            edge("e4", "o", "out"),
        ]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].head_id).toBeNull()
        expect(segments[0].node_ids).toEqual(["o", "out"])
    })

    it("splits at a transition barrier", () => {
        const nodes = [source("a"), source("b"), transition("t"), overlay("o"), output()]
        const edges = [
            edge("e1", "a", "t", "a"),
            edge("e2", "b", "t", "b"),
            edge("e3", "t", "o"),
            edge("e4", "o", "out"),
        ]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].head_id).toBeNull()
        expect(segments[0].node_ids).toEqual(["o", "out"])
    })

    it("splits at a burn subtitles barrier", () => {
        const nodes = [source("s"), subtitles("sub", "burn"), overlay("o"), output()]
        const edges = [edge("e1", "s", "sub"), edge("e2", "sub", "o"), edge("e3", "o", "out")]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].head_id).toBeNull()
        expect(segments[0].node_ids).toEqual(["o", "out"])
    })

    it("passes mux and sidecar subtitles through without splitting", () => {
        for (const mode of ["mux", "sidecar"] as const) {
            const nodes = [source("s"), subtitles("sub", mode), overlay("o"), output()]
            const edges = [edge("e1", "s", "sub"), edge("e2", "sub", "o"), edge("e3", "o", "out")]
            const segments = collect_stack_segments(nodes, edges)
            expect(segments).toHaveLength(1)
            expect(segments[0].head_id).toBe("s")
            expect(segments[0].node_ids).toEqual(["s", "sub", "o", "out"])
        }
    })

    it("flags fast path when every overlay window is closed against a solid head", () => {
        const nodes = [color("c", 2), overlay("o", 5, 6), output()]
        const edges = [edge("e1", "c", "o"), edge("e2", "o", "out")]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].head_id).toBe("c")
        expect(segments[0].fast_path).toBe(true)
    })

    it("flags fast path when every text window is closed against a solid head", () => {
        const nodes = [color("c", 2), text("x", 5, 6), output()]
        const edges = [edge("e1", "c", "x"), edge("e2", "x", "out")]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].fast_path).toBe(true)
    })

    it("flags fast path when the tail has no layers", () => {
        const nodes = [source("s"), output()]
        const edges = [edge("e1", "s", "out")]
        const segments = collect_stack_segments(nodes, edges)
        expect(segments).toHaveLength(1)
        expect(segments[0].head_id).toBe("s")
        expect(segments[0].node_ids).toEqual(["s", "out"])
        expect(segments[0].fast_path).toBe(true)
    })

    it("returns no segments without an output node", () => {
        expect(collect_stack_segments([source("s")], [])).toEqual([])
    })
})
