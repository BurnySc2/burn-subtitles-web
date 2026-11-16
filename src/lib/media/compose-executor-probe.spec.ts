import { beforeEach, describe, expect, it, vi } from "vitest"
import { execute_compose_graph } from "./compose-executor"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { extract_clip, type ProbeResult, probe_media } from "./mediabunny-clip"
import { render_merge } from "./mediabunny-merge"
import { render_solid_color } from "./mediabunny-solid"
import { render_transition } from "./mediabunny-transition"
import { resolve_audio_bitrate } from "./transition-utils"

vi.mock("./mediabunny-clip", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-clip")>()
    return { ...actual, extract_clip: vi.fn(), probe_media: vi.fn() }
})

vi.mock("./mediabunny-merge", () => ({ render_merge: vi.fn() }))

vi.mock("./mediabunny-solid", () => ({ render_solid_color: vi.fn() }))

vi.mock("./mediabunny-transition", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-transition")>()
    return { ...actual, render_transition: vi.fn() }
})

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

function source(id: string, probe: ProbeResult | null = null): ComposeNode {
    return { id, type: "source", position: { x: 0, y: 0 }, data: { file: mp4_file(`${id}.mp4`), probe } }
}

function trim(id: string, start = 10, end = 20): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start, end } }
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

function output(id = "out"): ComposeNode {
    return {
        id,
        type: "output",
        position: { x: 0, y: 0 },
        data: { file_name: null, width: 1280, height: 720, fps: 30, video_bitrate_kbps: 8000 },
    }
}

function edge(id: string, from: string, to: string, targetHandle: string | null = null): ComposeEdge {
    return { id, source: from, sourceHandle: null, target: to, targetHandle }
}

const MEMO_BLOB_PREFIXES = ["trim-input", "transition-", "merge-in", "burn-input", "text-bg", "overlay-bg"]

beforeEach(() => {
    vi.mocked(extract_clip).mockReset()
    vi.mocked(probe_media).mockReset()
    vi.mocked(render_merge).mockReset()
    vi.mocked(render_transition).mockReset()
    vi.mocked(render_solid_color).mockReset()
    vi.mocked(extract_clip).mockImplementation(async (options) => ({
        blob: mp4_blob(`trim-${options.file.name}-${options.start}-${options.end}`),
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
    vi.mocked(render_transition).mockImplementation(async () => ({
        blob: mp4_blob("transition"),
        extension: "mp4",
        mime: "video/mp4",
        cancel: () => Promise.resolve(),
    }))
    vi.mocked(render_solid_color).mockImplementation(async () => mp4_blob("color"))
})

describe("compose executor probe memo", () => {
    it("probes each source file once and never probes memo blobs", async () => {
        vi.mocked(probe_media).mockImplementation(async (file: File) =>
            make_probe({ file_name: file.name, audio_bitrate: file.name === "a.mp4" ? 96_000 : 256_000 }),
        )
        const result = await execute_compose_graph({
            nodes: [source("a"), source("b"), trim("ta"), trim("tb"), merge("m"), output()],
            edges: [
                edge("e1", "a", "ta"),
                edge("e2", "b", "tb"),
                edge("e3", "ta", "m", "in0"),
                edge("e4", "tb", "m", "in1"),
                edge("e5", "m", "out"),
            ],
        })
        expect(result.ok).toBe(true)
        expect(vi.mocked(probe_media)).toHaveBeenCalledTimes(2)
        const probed_names = vi
            .mocked(probe_media)
            .mock.calls.map((call) => (call[0] as File).name)
            .sort()
        expect(probed_names).toEqual(["a.mp4", "b.mp4"])
        for (const name of probed_names) {
            for (const prefix of MEMO_BLOB_PREFIXES) {
                expect(name.startsWith(prefix)).toBe(false)
            }
        }
        expect(vi.mocked(render_merge)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(render_merge).mock.calls[0]?.[0].audio_probe).toEqual({
            audio_bitrate: 256_000,
            overall_bitrate: null,
        })
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })

    it("unions diamond branches with shared probes deduped", async () => {
        const shared = make_probe({ file_name: "s.mp4", audio_bitrate: 192_000 })
        const result = await execute_compose_graph({
            nodes: [source("s", shared), trim("t1"), trim("t2"), merge("m"), output()],
            edges: [
                edge("e1", "s", "t1"),
                edge("e2", "s", "t2"),
                edge("e3", "t1", "m", "in0"),
                edge("e4", "t2", "m", "in1"),
                edge("e5", "m", "out"),
            ],
        })
        expect(result.ok).toBe(true)
        expect(vi.mocked(probe_media)).not.toHaveBeenCalled()
        expect(vi.mocked(render_merge).mock.calls[0]?.[0].audio_probe).toEqual({
            audio_bitrate: 192_000,
            overall_bitrate: null,
        })
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })

    it("passes peaked probes per transition branch with video fields intact", async () => {
        const probe_a = make_probe({ file_name: "a.mp4", audio_bitrate: 96_000 })
        const probe_b = make_probe({ file_name: "b.mp4", audio_bitrate: 256_000 })
        const result = await execute_compose_graph({
            nodes: [source("a", probe_a), source("b", probe_b), transition("x"), output()],
            edges: [edge("e1", "a", "x", "a"), edge("e2", "b", "x", "b"), edge("e3", "x", "out")],
        })
        expect(result.ok).toBe(true)
        expect(vi.mocked(probe_media)).not.toHaveBeenCalled()
        const call = vi.mocked(render_transition).mock.calls[0]?.[0]
        expect(call?.probe_a).toMatchObject({ audio_bitrate: 96_000, has_video: true, can_play: true })
        expect(call?.probe_b).toMatchObject({ audio_bitrate: 256_000, has_video: true, can_play: true })
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })

    it("falls back to null audio probe for color-only unions (128k default)", async () => {
        const result = await execute_compose_graph({
            nodes: [color("c1"), color("c2"), merge("m"), output()],
            edges: [edge("e1", "c1", "m", "in0"), edge("e2", "c2", "m", "in1"), edge("e3", "m", "out")],
        })
        expect(result.ok).toBe(true)
        expect(vi.mocked(probe_media)).not.toHaveBeenCalled()
        expect(vi.mocked(render_solid_color)).toHaveBeenCalledTimes(2)
        expect(vi.mocked(render_merge).mock.calls[0]?.[0].audio_probe).toBeNull()
        expect(resolve_audio_bitrate(null, null, "source-max")).toBe(128_000)
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })
})
