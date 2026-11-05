import { describe, expect, it } from "vitest"
import type { ComposeEdge, ComposeNode, SubtitlesNodeData } from "./compose-types"
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

const VALID_SRT = "1\n00:00:01,000 --> 00:00:02,000\nHi\n"

function srt_file(text: string = VALID_SRT): File {
    return new File([text], "test.srt", { type: "text/plain" })
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

function subtitles(id: string, file: File | null = srt_file()): ComposeNode {
    return { id, type: "subtitles", position: { x: 0, y: 0 }, data: { file, content: null } }
}

function styled_subtitles(overrides: Partial<SubtitlesNodeData>): ComposeNode {
    return {
        id: "sub",
        type: "subtitles",
        position: { x: 0, y: 0 },
        data: { file: srt_file(), content: null, ...overrides },
    }
}

function wired_subtitle_issues(overrides: Partial<SubtitlesNodeData>, is_chromium_browser = true) {
    const nodes = [source("src"), styled_subtitles(overrides), output()]
    const edges = [edge("e1", "src", "sub"), edge("e2", "sub", "out")]
    return validate_compose(nodes, edges, is_chromium_browser)
}

function font_file(name: string, size: number): File {
    return { name, size } as unknown as File
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

    it("flags a missing subtitle file only when wired", () => {
        const wired = [source("src"), subtitles("sub", null), output()]
        const wired_edges = [edge("e1", "src", "sub"), edge("e2", "sub", "out")]
        expect(validate_compose(wired, wired_edges)).toContainEqual({
            node_id: "sub",
            field: "file",
            message: "SRT file is required — attach an .srt file.",
        })

        const idle = [source("src"), subtitles("sub", null), trim("trim"), output()]
        const idle_edges = [edge("e1", "src", "trim"), edge("e2", "trim", "out")]
        const idle_issues = validate_compose(idle, idle_edges)
        expect(idle_issues.some((issue) => issue.field === "file")).toBe(false)
        expect(idle_issues.length).toBeGreaterThan(0)
    })

    it("flags legacy content without a file", () => {
        const legacy: ComposeNode = {
            id: "sub",
            type: "subtitles",
            position: { x: 0, y: 0 },
            data: { file: null, content: VALID_SRT },
        }
        const nodes = [source("src"), legacy, output()]
        const edges = [edge("e1", "src", "sub"), edge("e2", "sub", "out")]
        expect(validate_compose(nodes, edges)).toContainEqual({
            node_id: "sub",
            field: "file",
            message: "SRT file is required — attach an .srt file.",
        })
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

    it("accepts shorthand and full hex colors but rejects names and malformed hex", () => {
        for (const color of ["#fff", "#ffff7f"]) {
            const issues = wired_subtitle_issues({ text_color: color })
            expect(issues.filter((issue) => issue.field === "text_color")).toEqual([])
        }
        for (const color of ["red", "#gggggg"]) {
            expect(wired_subtitle_issues({ text_color: color })).toContainEqual({
                node_id: "sub",
                field: "text_color",
                message: "Subtitle text_color must be a hex color like #ffffff",
            })
        }
    })

    it("enforces subtitle numeric boundaries and tolerates unset or NaN values", () => {
        const cases = [
            { field: "font_size", min: 8, max: 160 },
            { field: "outline_size", min: 0, max: 10 },
            { field: "shadow_size", min: 0, max: 10 },
            { field: "horizontal_margin", min: 0, max: 2000 },
            { field: "vertical_offset", min: 0, max: 2000 },
        ] as const
        for (const { field, min, max } of cases) {
            for (const value of [min, max]) {
                const issues = wired_subtitle_issues({ [field]: value } as unknown as Partial<SubtitlesNodeData>)
                expect(issues.filter((issue) => issue.field === field)).toEqual([])
            }
            for (const value of [min - 1, max + 1]) {
                const issues = wired_subtitle_issues({ [field]: value } as unknown as Partial<SubtitlesNodeData>)
                expect(issues).toContainEqual({
                    node_id: "sub",
                    field,
                    message: `Subtitle ${field} must be between ${min} and ${max}`,
                })
            }
        }
        expect(wired_subtitle_issues({}).filter((issue) => issue.field === "font_size")).toEqual([])
        expect(wired_subtitle_issues({ font_size: Number.NaN }).filter((issue) => issue.field === "font_size")).toEqual(
            [],
        )
        expect(
            wired_subtitle_issues({ font_size: null } as unknown as Partial<SubtitlesNodeData>).filter(
                (issue) => issue.field === "font_size",
            ),
        ).toEqual([])
    })

    it("accepts subtitle font extensions and enforces the 10 MiB cap", () => {
        const mib = 1024 * 1024
        for (const name of ["font.ttf", "font.otf", "font.woff", "font.woff2", "font.TTF"]) {
            const issues = wired_subtitle_issues({ font_file: font_file(name, 1024) })
            expect(issues.filter((issue) => issue.field === "font_file")).toEqual([])
        }
        for (const name of ["font.txt", "font.eot", "font", "font.ttf.exe"]) {
            expect(wired_subtitle_issues({ font_file: font_file(name, 1024) })).toContainEqual({
                node_id: "sub",
                field: "font_file",
                message: "Subtitle font must be a ttf, otf, woff, or woff2 file",
            })
        }
        expect(
            wired_subtitle_issues({ font_file: font_file("font.ttf", 10 * mib) }).filter(
                (issue) => issue.field === "font_file",
            ),
        ).toEqual([])
        expect(wired_subtitle_issues({ font_file: font_file("font.ttf", 10 * mib + 1) })).toContainEqual({
            node_id: "sub",
            field: "font_file",
            message: "Subtitle font must not exceed 10 MiB",
        })
    })

    it("warns about burn-in outside Chromium browsers", () => {
        expect(wired_subtitle_issues({}, false)).toContainEqual({
            node_id: "sub",
            field: "mode",
            message: "Burn mode subtitles render best in a Chromium browser such as Chrome or Edge",
        })
        expect(wired_subtitle_issues({}, true).filter((issue) => issue.field === "mode")).toEqual([])
    })

    it("accepts subtitle nodes with an attached file", () => {
        const nodes = [source("src"), subtitles("sub"), output()]
        const edges = [edge("e1", "src", "sub"), edge("e2", "sub", "out")]
        expect(validate_compose(nodes, edges, true)).toEqual([])
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
