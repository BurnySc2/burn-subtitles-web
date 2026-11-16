import { describe, expect, it } from "vitest"
import {
    collect_output_probes,
    peak_audio_probe,
    resolve_output_audio_bps,
    union_probe_lists,
} from "./compose-probe-union"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import type { ProbeResult } from "./mediabunny-clip"

function make_probe(overrides: Partial<ProbeResult> = {}): ProbeResult {
    return {
        duration: null,
        has_video: false,
        has_audio: true,
        kind: "audio-only",
        file_name: "test",
        file_size: 0,
        container: null,
        mime_type: "audio/mpeg",
        overall_bitrate: null,
        video_count: 0,
        audio_count: 1,
        video_codec: null,
        video_codec_param: null,
        display_width: null,
        display_height: null,
        coded_width: null,
        coded_height: null,
        frame_rate: null,
        video_bitrate: null,
        audio_codec: null,
        audio_codec_param: null,
        audio_channels: null,
        audio_sample_rate: null,
        audio_bitrate: null,
        can_play: true,
        ...overrides,
    }
}

describe("union_probe_lists", () => {
    it("returns empty for empty input", () => {
        expect(union_probe_lists([])).toEqual([])
    })

    it("drops null and undefined lists", () => {
        expect(union_probe_lists([null, undefined])).toEqual([])
    })

    it("flattens lists in order", () => {
        const a = make_probe({ file_name: "a" })
        const b = make_probe({ file_name: "b" })
        expect(union_probe_lists([[a], null, [b]])).toEqual([a, b])
    })

    it("dedupes by reference", () => {
        const shared = make_probe({ file_name: "shared" })
        expect(union_probe_lists([[shared], [shared]])).toEqual([shared])
    })

    it("keeps distinct probes with equal content", () => {
        const first = make_probe({ file_name: "same" })
        const second = make_probe({ file_name: "same" })
        expect(union_probe_lists([[first, second]])).toEqual([first, second])
    })
})

describe("peak_audio_probe", () => {
    it("returns null for null input", () => {
        expect(peak_audio_probe(null)).toBeNull()
    })

    it("returns null for undefined input", () => {
        expect(peak_audio_probe(undefined)).toBeNull()
    })

    it("returns null for empty input", () => {
        expect(peak_audio_probe([])).toBeNull()
    })

    it("returns null when no bitrates are present", () => {
        expect(peak_audio_probe([make_probe()])).toBeNull()
    })

    it("ignores non-finite and non-positive bitrates", () => {
        const probes = [
            make_probe({ audio_bitrate: 0, overall_bitrate: -10 }),
            make_probe({ audio_bitrate: Number.NaN, overall_bitrate: Number.POSITIVE_INFINITY }),
        ]
        expect(peak_audio_probe(probes)).toBeNull()
    })

    it("returns the peak audio bitrate", () => {
        const probes = [make_probe({ audio_bitrate: 96_000 }), make_probe({ audio_bitrate: 192_000 })]
        expect(peak_audio_probe(probes)).toEqual({ audio_bitrate: 192_000, overall_bitrate: null })
    })

    it("prefers audio over a higher overall bitrate", () => {
        const probes = [make_probe({ audio_bitrate: 128_000, overall_bitrate: 500_000 })]
        expect(peak_audio_probe(probes)).toEqual({ audio_bitrate: 128_000, overall_bitrate: null })
    })

    it("falls back to the peak overall bitrate", () => {
        const probes = [make_probe({ overall_bitrate: 200_000 }), make_probe({ overall_bitrate: 300_000 })]
        expect(peak_audio_probe(probes)).toEqual({ audio_bitrate: 300_000, overall_bitrate: null })
    })

    it("passes low peaks through unclamped", () => {
        expect(peak_audio_probe([make_probe({ audio_bitrate: 40_000 })])).toEqual({
            audio_bitrate: 40_000,
            overall_bitrate: null,
        })
    })

    it("passes high peaks through unclamped", () => {
        expect(peak_audio_probe([make_probe({ audio_bitrate: 500_000 })])).toEqual({
            audio_bitrate: 500_000,
            overall_bitrate: null,
        })
    })
})

function make_source(id: string, probe: ProbeResult | null): ComposeNode {
    return { id, type: "source", position: { x: 0, y: 0 }, data: { file: null, probe } }
}

function make_output(id: string): ComposeNode {
    return {
        id,
        type: "output",
        position: { x: 0, y: 0 },
        data: { file_name: null, width: 1280, height: 720, fps: 30, video_bitrate_kbps: 8000 },
    }
}

function make_trim(id: string): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start: null, end: null } }
}

function make_edge(id: string, source: string, target: string): ComposeEdge {
    return { id, source, sourceHandle: null, target, targetHandle: null }
}

describe("collect_output_probes", () => {
    it("returns empty for an empty graph", () => {
        expect(collect_output_probes([], [])).toEqual([])
    })

    it("returns empty when there is no output node", () => {
        const probe = make_probe({ file_name: "a" })
        expect(collect_output_probes([make_source("src", probe)], [])).toEqual([])
    })

    it("skips sources with null probes", () => {
        const nodes = [make_source("src", null), make_output("out")]
        const edges = [make_edge("e", "src", "out")]
        expect(collect_output_probes(nodes, edges)).toEqual([])
    })

    it("collects upstream probes through intermediate nodes", () => {
        const first = make_probe({ file_name: "a" })
        const second = make_probe({ file_name: "b" })
        const nodes = [make_source("a", first), make_source("b", second), make_trim("t"), make_output("out")]
        const edges = [make_edge("e1", "a", "t"), make_edge("e2", "b", "t"), make_edge("e3", "t", "out")]
        expect(collect_output_probes(nodes, edges)).toEqual([first, second])
    })

    it("ignores sources disconnected from the output", () => {
        const connected = make_probe({ file_name: "connected" })
        const stray = make_probe({ file_name: "stray" })
        const nodes = [make_source("a", connected), make_source("stray", stray), make_output("out")]
        const edges = [make_edge("e", "a", "out")]
        expect(collect_output_probes(nodes, edges)).toEqual([connected])
    })

    it("terminates on cyclic edges", () => {
        const probe = make_probe({ file_name: "a" })
        const nodes = [make_source("a", probe), make_trim("t"), make_output("out")]
        const edges = [make_edge("e1", "a", "t"), make_edge("e2", "t", "out"), make_edge("e3", "out", "t")]
        expect(collect_output_probes(nodes, edges)).toEqual([probe])
    })
})

describe("resolve_output_audio_bps", () => {
    it("falls back to the default for an empty graph", () => {
        expect(resolve_output_audio_bps([], [], "source-max")).toBe(128_000)
    })

    it("falls back to the default when there is no output node", () => {
        const nodes = [make_source("src", make_probe({ audio_bitrate: 192_000 }))]
        expect(resolve_output_audio_bps(nodes, [], "source-max")).toBe(128_000)
    })

    it("falls back to the default when probes are null", () => {
        const nodes = [make_source("src", null), make_output("out")]
        const edges = [make_edge("e", "src", "out")]
        expect(resolve_output_audio_bps(nodes, edges, "source-max")).toBe(128_000)
    })

    it("resolves the multi-source peak", () => {
        const nodes = [
            make_source("a", make_probe({ audio_bitrate: 96_000 })),
            make_source("b", make_probe({ audio_bitrate: 192_000 })),
            make_output("out"),
        ]
        const edges = [make_edge("e1", "a", "out"), make_edge("e2", "b", "out")]
        expect(resolve_output_audio_bps(nodes, edges, "source-max")).toBe(192_000)
    })

    it("falls back to the peak overall bitrate", () => {
        const nodes = [
            make_source("a", make_probe({ overall_bitrate: 200_000 })),
            make_source("b", make_probe({ overall_bitrate: 300_000 })),
            make_output("out"),
        ]
        const edges = [make_edge("e1", "a", "out"), make_edge("e2", "b", "out")]
        expect(resolve_output_audio_bps(nodes, edges, "source-max")).toBe(300_000)
    })

    it("passes quality presets through regardless of probes", () => {
        const nodes = [
            make_source("a", make_probe({ audio_bitrate: 96_000 })),
            make_source("b", make_probe({ audio_bitrate: 192_000 })),
            make_output("out"),
        ]
        const edges = [make_edge("e1", "a", "out"), make_edge("e2", "b", "out")]
        expect(resolve_output_audio_bps(nodes, edges, "192k")).toBe(192_000)
        expect(resolve_output_audio_bps([], [], "96k")).toBe(96_000)
    })
})
