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
                data: { file_name: null, width: 1280, height: 720, fps: 30, quality: "medium" },
            }
        default:
            return { id, type, position, data: { start: 0, end: 1 } }
    }
}

function output_data(overrides: Partial<OutputNodeData> = {}): OutputNodeData {
    return { file_name: null, width: 1280, height: 720, fps: 30, quality: "medium", ...overrides }
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
    it("resolves the medium preset by default", () => {
        const config = effective_encode_config(output_data())
        expect(config.bitrate).toBe(5_000_000)
        expect(config.quantizer).toBe(26)
    })

    it("leaves ultra bitrate-only", () => {
        const config = effective_encode_config(output_data({ quality: "ultra" }))
        expect(config.bitrate).toBe(50_000_000)
        expect(config.quantizer).toBeNull()
    })

    it("applies a CRF override", () => {
        const config = effective_encode_config(output_data({ crf: 20 }))
        expect(config.quantizer).toBe(20)
    })
})

describe("format_encode_hint", () => {
    it("formats quantizer and bitrate-only configs", () => {
        expect(format_encode_hint({ bitrate: 5_000_000, quantizer: 26, description: "" })).toBe(
            "Effective: 5 Mbps + quantizer 26",
        )
        expect(format_encode_hint({ bitrate: 50_000_000, quantizer: null, description: "" })).toBe(
            "Effective: 50 Mbps (bitrate-only)",
        )
    })
})

describe("encode_hint_for_graph", () => {
    it("marks passthrough graphs CRF-inert", () => {
        expect(encode_hint_for_graph([], output_data())).toEqual({
            reencodes: false,
            text: "CRF inert on this graph (passthrough: source/trim→output only)",
        })
    })

    it("returns null text without output on re-encoding graphs", () => {
        expect(encode_hint_for_graph([node("m", "merge")])).toEqual({ reencodes: true, text: null })
        expect(encode_hint_for_graph([node("m", "merge")], null)).toEqual({ reencodes: true, text: null })
    })

    it("formats the effective config when a sink and output exist", () => {
        expect(encode_hint_for_graph([node("s", "subtitles")], output_data())).toEqual({
            reencodes: true,
            text: "Effective: 5 Mbps + quantizer 26",
        })
    })
})
