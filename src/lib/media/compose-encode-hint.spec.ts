import { describe, expect, it } from "vitest"
import {
    effective_encode_config,
    encode_hint_for_graph,
    format_encode_hint,
    has_reencode_sink,
    REENCODE_NODE_KINDS,
} from "./compose-encode-hint"
import type { ComposeNode, OutputNodeData } from "./compose-types"

function node(id: string, type: ComposeNode["type"] = "trim"): ComposeNode {
    const position = { x: 0, y: 0 }
    switch (type) {
        case "source":
            return { id, type, position, data: { file: null, probe: null } }
        case "transition":
            return { id, type, position, data: { start: 0, duration: 1, easing: "linear" } }
        case "merge":
            return { id, type, position, data: { input_count: 2 } }
        case "subtitles":
            return { id, type, position, data: { file: null, mode: "burn" } }
        case "overlay":
            return {
                id,
                type,
                position,
                data: {
                    image: null,
                    position: "top-right",
                    scale: 100,
                    opacity: 1,
                    offset_x: 0,
                    offset_y: 0,
                    show_start: 0,
                    show_end: null,
                },
            }
        case "color":
            return { id, type, position, data: { color: "#000000", duration: 20 } }
        case "rescale":
            return { id, type, position, data: { width: 1920, height: 1080, fps: null, fit: "contain" } }
        case "text":
            return { id, type, position, data: { items: [] } }
        case "output":
            return {
                id,
                type,
                position,
                data: { file_name: null, width: 1280, height: 720, fps: 30, video_bitrate_kbps: 8000 },
            }
        default:
            return { id, type, position, data: { start: 0, end: 1 } }
    }
}

function output_data(overrides: Partial<OutputNodeData> = {}): OutputNodeData {
    return { file_name: null, width: 1280, height: 720, fps: 30, video_bitrate_kbps: 8000, ...overrides }
}

describe("has_reencode_sink", () => {
    it("returns false for empty and passthrough-only graphs", () => {
        expect(has_reencode_sink([])).toBe(false)
        expect(has_reencode_sink([node("s", "source"), node("t", "trim"), node("o", "output")])).toBe(false)
    })

    it("flags every re-encode sink kind", () => {
        for (const kind of REENCODE_NODE_KINDS) {
            expect(has_reencode_sink([node(kind, kind as ComposeNode["type"])])).toBe(true)
        }
    })

    it("flags mixed graphs containing a sink", () => {
        expect(has_reencode_sink([node("s", "source"), node("t", "trim"), node("c", "color")])).toBe(true)
    })
})

describe("effective_encode_config", () => {
    it("resolves 8000 kbps to 8 Mbps", () => {
        const config = effective_encode_config(output_data({ video_bitrate_kbps: 8000 }))
        expect(config.bitrate).toBe(8_000_000)
    })

    it("covers 5 Mbps and 50 Mbps bitrates", () => {
        expect(effective_encode_config(output_data({ video_bitrate_kbps: 5000 })).bitrate).toBe(5_000_000)
        expect(effective_encode_config(output_data({ video_bitrate_kbps: 50000 })).bitrate).toBe(50_000_000)
    })
})

describe("format_encode_hint", () => {
    it("formats bitrate configs as VBR", () => {
        expect(format_encode_hint({ bitrate: 5_000_000, description: "" })).toBe("Effective: 5 Mbps VBR")
        expect(format_encode_hint({ bitrate: 8_000_000, description: "" })).toBe("Effective: 8 Mbps VBR")
    })
})

describe("encode_hint_for_graph", () => {
    it("marks passthrough graphs as no re-encode", () => {
        expect(encode_hint_for_graph([], output_data())).toEqual({
            reencodes: false,
            text: "Passthrough graph (source/trim→output only): no re-encode",
        })
    })

    it("returns null text without output on re-encoding graphs", () => {
        expect(encode_hint_for_graph([node("m", "merge")])).toEqual({ reencodes: true, text: null })
        expect(encode_hint_for_graph([node("m", "merge")], null)).toEqual({ reencodes: true, text: null })
    })

    it("formats the 8 Mbps effective config when a sink and output exist", () => {
        expect(encode_hint_for_graph([node("s", "subtitles")], output_data())).toEqual({
            reencodes: true,
            text: "Effective: 8 Mbps VBR",
        })
    })

    it("returns null text for an invalid bitrate", () => {
        expect(encode_hint_for_graph([node("s", "subtitles")], output_data({ video_bitrate_kbps: 499 }))).toEqual({
            reencodes: true,
            text: null,
        })
    })
})
