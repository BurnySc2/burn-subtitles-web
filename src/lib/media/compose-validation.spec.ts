import { describe, expect, it } from "vitest"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { compose_node_durations, validate_compose } from "./compose-validation"
import type { ProbeResult } from "./mediabunny-clip"

function probe_with(duration: number | null): ProbeResult {
    return {
        duration,
        has_video: true,
        has_audio: true,
        kind: "video",
        file_name: "clip.mp4",
        file_size: 1024,
        container: "mp4",
        mime_type: "video/mp4",
        overall_bitrate: null,
        video_count: 1,
        audio_count: 1,
        video_codec: "avc",
        video_codec_param: null,
        display_width: 1280,
        display_height: 720,
        coded_width: 1280,
        coded_height: 720,
        frame_rate: 30,
        video_bitrate: null,
        audio_codec: "aac",
        audio_codec_param: null,
        audio_channels: 2,
        audio_sample_rate: 48000,
        audio_bitrate: null,
        can_play: true,
    }
}

function source(id: string, duration: number | null = 120): ComposeNode {
    return {
        id,
        type: "source",
        position: { x: 0, y: 0 },
        data: { file: new File(["clip-bytes"], "clip.mp4", { type: "video/mp4" }), probe: probe_with(duration) },
    }
}

function trim(id: string, start = 10, end = 20): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start, end } }
}

function subtitles(id: string, content: string | null = "1\n00:00:01,000 --> 00:00:02,000\nHi\n"): ComposeNode {
    return { id, type: "subtitles", position: { x: 0, y: 0 }, data: { file: null, content, mode: "mux" } }
}

function transition(id: string, start = 0, duration = 1): ComposeNode {
    return { id, type: "transition", position: { x: 0, y: 0 }, data: { start, duration, easing: "linear" } }
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

describe("validate_compose", () => {
    it("accepts a valid source to trim to output graph", () => {
        const nodes = [source("src"), trim("trim"), output()]
        const edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        expect(validate_compose(nodes, edges)).toEqual([])
    })

    it("flags missing and duplicate output nodes", () => {
        expect(validate_compose([source("src")], []).some((issue) => issue.field === "output")).toBe(true)
        const nodes = [source("src"), output("out1"), output("out2")]
        const issues = validate_compose(nodes, [])
        expect(issues).toContainEqual({
            node_id: null,
            field: "output",
            message: "Expected exactly 1 output node, found 2",
        })
    })

    it("flags a source node with an input", () => {
        const nodes = [source("a"), source("b"), output()]
        const edges = [edge("e1", "a", "b"), edge("e2", "b", "out")]
        expect(validate_compose(nodes, edges)).toContainEqual({
            node_id: "b",
            field: "input",
            message: "Source node must have no inputs",
        })
    })

    it("flags trim and output arity violations", () => {
        const nodes = [source("src"), trim("trim"), output()]
        expect(validate_compose(nodes, [edge("e1", "trim", "out")])).toContainEqual({
            node_id: "trim",
            field: "input",
            message: "Trim node must have exactly 1 input",
        })
        expect(validate_compose(nodes, [])).toContainEqual({
            node_id: "out",
            field: "input",
            message: "Output node must have exactly 1 input",
        })
    })

    it("requires two a and b inputs on transition nodes", () => {
        const good = [source("a"), source("b"), transition("x"), output()]
        const good_edges = [edge("e1", "a", "x", "a"), edge("e2", "b", "x", "b"), edge("e3", "x", "out")]
        expect(validate_compose(good, good_edges)).toEqual([])

        const single = [source("a"), transition("x"), output()]
        const single_edges = [edge("e1", "a", "x", "a"), edge("e2", "x", "out")]
        expect(validate_compose(single, single_edges)).toContainEqual({
            node_id: "x",
            field: "input",
            message: "Transition node must have exactly 2 inputs",
        })

        const wrong_handles = [source("a"), source("b"), transition("x"), output()]
        const wrong_edges = [edge("e1", "a", "x", "a"), edge("e2", "b", "x", "a"), edge("e3", "x", "out")]
        expect(validate_compose(wrong_handles, wrong_edges)).toContainEqual({
            node_id: "x",
            field: "input",
            message: 'Transition node must have inputs "a" and "b"',
        })
    })

    it("flags nodes that never reach the output", () => {
        const nodes = [source("src"), trim("trim"), source("stray"), output()]
        const edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        expect(validate_compose(nodes, edges)).toContainEqual({
            node_id: "stray",
            field: "connection",
            message: "Node does not reach the output",
        })
    })

    it("flags trim ranges outside the probe duration and skips unknown durations", () => {
        const over = [source("src", 30), trim("trim", 10, 40), output()]
        const over_edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        expect(validate_compose(over, over_edges).some((issue) => issue.field === "end")).toBe(true)

        const unknown = [source("src", null), trim("trim", 10, 40), output()]
        const unknown_edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        expect(validate_compose(unknown, unknown_edges)).toEqual([])
    })

    it("flags trim ranges where end is not after start", () => {
        const nodes = [source("src"), trim("trim", 20, 10), output()]
        const edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        expect(validate_compose(nodes, edges).some((issue) => issue.field === "range")).toBe(true)
    })

    it("flags non-positive transition durations", () => {
        const nodes = [source("a"), source("b"), transition("x", 0, 0), output()]
        const edges = [edge("e1", "a", "x", "a"), edge("e2", "b", "x", "b"), edge("e3", "x", "out")]
        expect(validate_compose(nodes, edges)).toContainEqual({
            node_id: "x",
            field: "duration",
            message: "Transition duration must be greater than 0",
        })
    })

    it("flags empty subtitles only when wired", () => {
        const wired = [source("src"), subtitles("sub", "  "), output()]
        const wired_edges = [edge("e1", "src", "sub"), edge("e2", "sub", "out")]
        expect(validate_compose(wired, wired_edges)).toContainEqual({
            node_id: "sub",
            field: "content",
            message: "Subtitle content must not be empty",
        })

        const idle = [source("src"), subtitles("sub", null), trim("trim"), output()]
        const idle_edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        const idle_issues = validate_compose(idle, idle_edges)
        expect(idle_issues.some((issue) => issue.field === "content")).toBe(false)
        expect(idle_issues.length).toBeGreaterThan(0)
    })

    it("flags duplicate connections on the same handles", () => {
        const nodes = [source("src"), trim("trim"), output()]
        const edges = [edge("e1", "src", "trim"), edge("e2", "src", "trim"), edge("e3", "trim", "out")]
        expect(validate_compose(nodes, edges)).toContainEqual({
            node_id: "trim",
            field: "connection",
            message: 'Duplicate connection from "src" — remove the extra edge',
        })
    })

    it("flags merge handle misuse: wrong pattern, duplicates, and outside input_count", () => {
        const bad_pattern = [source("a"), source("b"), merge("m"), output()]
        const bad_pattern_edges = [edge("e1", "a", "m", "a"), edge("e2", "b", "m", "in1"), edge("e3", "m", "out")]
        expect(validate_compose(bad_pattern, bad_pattern_edges)).toContainEqual({
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

        const outside = [source("a"), source("b"), merge("m", 2), output()]
        const outside_edges = [edge("e1", "a", "m", "in0"), edge("e2", "b", "m", "in5"), edge("e3", "m", "out")]
        expect(
            validate_compose(outside, outside_edges).some((issue) => issue.message.includes("outside input_count")),
        ).toBe(true)
    })

    it("flags invalid output CRF and unknown audio quality", () => {
        const bad_crf: ComposeNode = {
            id: "out",
            type: "output",
            position: { x: 0, y: 0 },
            data: { file_name: null, width: 1280, height: 720, fps: 30, quality: "medium", crf: 99 },
        }
        const crf_nodes = [source("src"), trim("trim"), bad_crf]
        const crf_edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        expect(validate_compose(crf_nodes, crf_edges)).toContainEqual({
            node_id: "out",
            field: "crf",
            message: "CRF must be a number from 0 to 51.",
        })

        const bad_quality: ComposeNode = {
            id: "out",
            type: "output",
            position: { x: 0, y: 0 },
            data: {
                file_name: null,
                width: 1280,
                height: 720,
                fps: 30,
                quality: "medium",
                audio_quality: "999k" as never,
            },
        }
        const quality_nodes = [source("src"), trim("trim"), bad_quality]
        expect(validate_compose(quality_nodes, crf_edges)).toContainEqual({
            node_id: "out",
            field: "audio_quality",
            message: "Unknown output audio quality.",
        })
    })
})

describe("compose_node_durations", () => {
    it("covers every node id and propagates connected durations", () => {
        const nodes = [source("src"), trim("trim"), output()]
        const edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        const durations = compose_node_durations(nodes, edges)
        expect([...durations.keys()].sort()).toEqual(["out", "src", "trim"])
        expect(durations.get("src")).toBe(120)
        expect(durations.get("trim")).toBe(10)
        expect(durations.get("out")).toBe(10)
    })

    it("yields null for disconnected trims and unknown probe durations", () => {
        const stray = [source("src"), trim("stray"), output()]
        expect(compose_node_durations(stray, []).get("stray")).toBeNull()
        const unknown = [source("src", null), trim("trim", 10, 40), output()]
        const wired = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        const durations = compose_node_durations(unknown, wired)
        expect(durations.get("src")).toBeNull()
        expect(durations.get("trim")).toBeNull()
    })
})
