import { beforeEach, describe, expect, it, vi } from "vitest"
import { clear_node_preview_cache, get_node_preview_blob } from "./compose-preview"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import type { ProbeResult } from "./mediabunny-clip"
import { render_merge } from "./mediabunny-merge"
import { render_transition } from "./mediabunny-transition"

vi.mock("./mediabunny-transition", () => ({ render_transition: vi.fn() }))

vi.mock("./mediabunny-merge", () => ({ render_merge: vi.fn() }))

const mp4_blob = (text: string): Blob => new Blob([text], { type: "video/mp4" })

const mp4_file = (name: string): File => new File([`${name}-bytes`], name, { type: "video/mp4" })

function make_probe(overrides: Partial<ProbeResult> = {}): ProbeResult {
    return {
        duration: 60,
        has_video: true,
        has_audio: true,
        kind: "video",
        file_name: "test.mp4",
        file_size: 1000,
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
        video_bitrate: 5_000_000,
        audio_codec: "aac",
        audio_codec_param: null,
        audio_channels: 2,
        audio_sample_rate: 48000,
        audio_bitrate: 128_000,
        can_play: true,
        ...overrides,
    }
}

function source(id: string, probe: ProbeResult | null): ComposeNode {
    return { id, type: "source", position: { x: 0, y: 0 }, data: { file: mp4_file(`${id}.mp4`), probe } }
}

function transition(id: string): ComposeNode {
    return { id, type: "transition", position: { x: 0, y: 0 }, data: { start: 0, duration: 1, easing: "linear" } }
}

function merge(id: string, input_count = 2): ComposeNode {
    return { id, type: "merge", position: { x: 0, y: 0 }, data: { input_count } }
}

function color(id: string): ComposeNode {
    return { id, type: "color", position: { x: 0, y: 0 }, data: { color: "#112233", duration: 5 } }
}

function edge(id: string, from: string, to: string, targetHandle: string | null = null): ComposeEdge {
    return { id, source: from, sourceHandle: null, target: to, targetHandle }
}

beforeEach(() => {
    clear_node_preview_cache()
    vi.mocked(render_transition).mockReset()
    vi.mocked(render_merge).mockReset()
    vi.mocked(render_transition).mockImplementation(async () => ({
        blob: mp4_blob("transition"),
        extension: "mp4",
        mime: "video/mp4",
        cancel: () => Promise.resolve(),
    }))
    vi.mocked(render_merge).mockImplementation(async () => ({
        blob: mp4_blob("merged"),
        extension: "mp4",
        mime: "video/mp4",
        cancel: () => Promise.resolve(),
    }))
})

describe("compose-preview audio probes", () => {
    it("threads peaked probes per transition branch", async () => {
        const probe_a = make_probe({ file_name: "a.mp4", audio_bitrate: 96_000 })
        const probe_b = make_probe({ file_name: "b.mp4", audio_bitrate: 256_000 })
        const blob = await get_node_preview_blob(
            "x",
            [source("a", probe_a), source("b", probe_b), transition("x")],
            [edge("e1", "a", "x", "a"), edge("e2", "b", "x", "b")],
        )
        expect(blob).not.toBeNull()
        const call = vi.mocked(render_transition).mock.calls[0]?.[0]
        expect(call?.probe_a).toMatchObject({ audio_bitrate: 96_000, has_video: true, can_play: true })
        expect(call?.probe_b).toMatchObject({ audio_bitrate: 256_000, has_video: true, can_play: true })
    })

    it("falls back to null probes when sources are unprobed", async () => {
        const blob = await get_node_preview_blob(
            "x",
            [source("a", null), source("b", null), transition("x")],
            [edge("e1", "a", "x", "a"), edge("e2", "b", "x", "b")],
        )
        expect(blob).not.toBeNull()
        const call = vi.mocked(render_transition).mock.calls[0]?.[0]
        expect(call?.probe_a).toBeNull()
        expect(call?.probe_b).toBeNull()
    })

    it("threads peak audio probe into merge", async () => {
        const probe_a = make_probe({ file_name: "a.mp4", audio_bitrate: 96_000 })
        const probe_b = make_probe({ file_name: "b.mp4", audio_bitrate: 256_000 })
        const blob = await get_node_preview_blob(
            "m",
            [source("a", probe_a), source("b", probe_b), merge("m")],
            [edge("e1", "a", "m", "in0"), edge("e2", "b", "m", "in1")],
        )
        expect(blob).not.toBeNull()
        expect(vi.mocked(render_merge).mock.calls[0]?.[0].audio_probe).toEqual({
            audio_bitrate: 256_000,
            overall_bitrate: null,
        })
    })

    it("falls back to null audio probe for color-only merge", async () => {
        const blob = await get_node_preview_blob(
            "m",
            [color("c1"), color("c2"), merge("m")],
            [edge("e1", "c1", "m", "in0"), edge("e2", "c2", "m", "in1")],
        )
        expect(blob).not.toBeNull()
        expect(vi.mocked(render_merge).mock.calls[0]?.[0].audio_probe).toBeNull()
    })
})
