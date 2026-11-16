import { beforeEach, describe, expect, it, vi } from "vitest"
import { execute_compose_graph } from "./compose-executor"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { extract_clip } from "./mediabunny-clip"
import { render_compose_stack } from "./mediabunny-compose-stack"
import { render_overlay } from "./mediabunny-overlay"
import { render_rescale } from "./mediabunny-rescale"
import { render_subtitles_burn } from "./mediabunny-subtitles"

vi.mock("./mediabunny-clip", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-clip")>()
    return { ...actual, extract_clip: vi.fn() }
})

vi.mock("./mediabunny-compose-stack", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-compose-stack")>()
    return { ...actual, render_compose_stack: vi.fn() }
})

vi.mock("./mediabunny-overlay", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-overlay")>()
    return { ...actual, render_overlay: vi.fn() }
})

vi.mock("./mediabunny-rescale", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-rescale")>()
    return { ...actual, render_rescale: vi.fn() }
})

vi.mock("./mediabunny-subtitles", () => ({ render_subtitles_burn: vi.fn() }))

const mp4_blob = (text: string): Blob => new Blob([text], { type: "video/mp4" })

const mp4_file = (name: string): File => new File([`${name}-bytes`], name, { type: "video/mp4" })

const image_file = (name: string): File => new File([`${name}-bytes`], name, { type: "image/png" })

function source(id: string): ComposeNode {
    return { id, type: "source", position: { x: 0, y: 0 }, data: { file: mp4_file(`${id}.mp4`), probe: null } }
}

function trim(id: string, start = 10, end = 20): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start, end } }
}

function overlay(id: string): ComposeNode {
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
            show_start: 0,
            show_end: null,
        },
    }
}

function rescale(id: string): ComposeNode {
    return {
        id,
        type: "rescale",
        position: { x: 0, y: 0 },
        data: { width: 640, height: 360, fps: 24, fit: "contain" },
    }
}

const VALID_SRT = "1\n00:00:01,000 --> 00:00:02,000\nHi\n"

function subtitles(id: string): ComposeNode {
    return {
        id,
        type: "subtitles",
        position: { x: 0, y: 0 },
        data: { file: new File([VALID_SRT], "test.srt"), mode: "burn" },
    }
}

function output(id = "out"): ComposeNode {
    return {
        id,
        type: "output",
        position: { x: 0, y: 0 },
        data: { file_name: null, width: 1280, height: 720, fps: 30, quality: "medium" },
    }
}

function edge(id: string, from: string, to: string): ComposeEdge {
    return { id, source: from, sourceHandle: null, target: to, targetHandle: null }
}

function revoke(result_url: string | undefined): void {
    if (result_url) {
        URL.revokeObjectURL(result_url)
    }
}

beforeEach(() => {
    vi.mocked(extract_clip).mockReset()
    vi.mocked(render_compose_stack).mockReset()
    vi.mocked(render_subtitles_burn).mockReset()
    vi.mocked(render_overlay).mockReset()
    vi.mocked(render_rescale).mockReset()
    vi.mocked(extract_clip).mockImplementation(async (options) => ({
        blob: mp4_blob(`trim-${options.start}-${options.end}`),
        extension: "mp4",
        mime: "video/mp4",
        cancel: () => Promise.resolve(),
    }))
    vi.mocked(render_compose_stack).mockImplementation(async () => ({
        blob: mp4_blob("stacked"),
        extension: "mp4",
        mime: "video/mp4",
        cancel: () => Promise.resolve(),
    }))
    vi.mocked(render_overlay).mockImplementation(async () => ({
        blob: mp4_blob("overlay"),
        extension: "mp4",
        mime: "video/mp4",
        cancel: () => Promise.resolve(),
    }))
    vi.mocked(render_rescale).mockImplementation(async () => mp4_blob("rescaled"))
    vi.mocked(render_subtitles_burn).mockImplementation(async () => mp4_blob("burned"))
})

describe("execute_compose_graph fused stack", () => {
    it("renders source->overlay->output through one stack call with head, image, and output dims", async () => {
        const result = await execute_compose_graph({
            nodes: [source("s"), overlay("o"), output()],
            edges: [edge("e1", "s", "o"), edge("e2", "o", "out")],
        })
        expect(result.ok).toBe(true)
        expect(vi.mocked(render_compose_stack)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(render_overlay)).not.toHaveBeenCalled()
        const call = vi.mocked(render_compose_stack).mock.calls[0]?.[0]
        expect(call?.head.kind).toBe("blob")
        if (call?.head.kind === "blob") {
            expect(call.head.file).toBeInstanceOf(File)
            expect(await call.head.file?.text()).toBe("s.mp4-bytes")
        }
        expect(call?.layers).toHaveLength(1)
        expect(call?.layers[0]?.kind).toBe("overlay")
        if (call?.layers[0]?.kind === "overlay") {
            expect(call.layers[0].image).toBeInstanceOf(File)
            expect(call.layers[0].node_id).toBe("o")
        }
        expect(call?.target.width).toBe(1280)
        expect(call?.target.height).toBe(720)
        expect(call?.target.fps).toBe(30)
        expect(call?.terminal_rescale).toBeNull()
        revoke(result.output?.url)
    })

    it("uses the trimmed blob as the stack head after a trim barrier", async () => {
        const result = await execute_compose_graph({
            nodes: [source("s"), trim("t"), overlay("o"), output()],
            edges: [edge("e1", "s", "t"), edge("e2", "t", "o"), edge("e3", "o", "out")],
        })
        expect(result.ok).toBe(true)
        expect(vi.mocked(extract_clip)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(render_compose_stack)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(render_overlay)).not.toHaveBeenCalled()
        const call = vi.mocked(render_compose_stack).mock.calls[0]?.[0]
        expect(call?.head.kind).toBe("blob")
        if (call?.head.kind === "blob") {
            expect(await call.head.file?.text()).toBe("trim-10-20")
        }
        expect(call?.layers).toHaveLength(1)
        revoke(result.output?.url)
    })

    it("applies terminal rescale dims and fps to the stack target", async () => {
        const result = await execute_compose_graph({
            nodes: [source("s"), overlay("o"), rescale("r"), output()],
            edges: [edge("e1", "s", "o"), edge("e2", "o", "r"), edge("e3", "r", "out")],
        })
        expect(result.ok).toBe(true)
        expect(vi.mocked(render_compose_stack)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(render_overlay)).not.toHaveBeenCalled()
        expect(vi.mocked(render_rescale)).not.toHaveBeenCalled()
        const call = vi.mocked(render_compose_stack).mock.calls[0]?.[0]
        expect(call?.target.width).toBe(640)
        expect(call?.target.height).toBe(360)
        expect(call?.target.fps).toBe(24)
        expect(call?.terminal_rescale).toMatchObject({ width: 640, height: 360, fps: 24 })
        revoke(result.output?.url)
    })

    it("burns subtitles before the fused overlay stack", async () => {
        const result = await execute_compose_graph({
            nodes: [source("s"), subtitles("sub"), overlay("o"), output()],
            edges: [edge("e1", "s", "sub"), edge("e2", "sub", "o"), edge("e3", "o", "out")],
        })
        expect(result.ok).toBe(true)
        expect(vi.mocked(render_subtitles_burn)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(render_compose_stack)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(render_overlay)).not.toHaveBeenCalled()
        revoke(result.output?.url)
    })

    it("maps fused span progress monotonically to completion", async () => {
        vi.mocked(render_compose_stack).mockImplementationOnce(async (options) => {
            options.on_progress?.(0)
            options.on_progress?.(0.5)
            options.on_progress?.(1)
            return {
                blob: mp4_blob("stacked"),
                extension: "mp4",
                mime: "video/mp4",
                cancel: () => Promise.resolve(),
            }
        })
        const seen: number[] = []
        const result = await execute_compose_graph({
            nodes: [source("s"), overlay("o"), output()],
            edges: [edge("e1", "s", "o"), edge("e2", "o", "out")],
            on_progress: (progress) => seen.push(progress),
        })
        expect(result.ok).toBe(true)
        expect(seen.length).toBeGreaterThan(0)
        expect(seen[seen.length - 1]).toBe(1)
        for (let index = 1; index < seen.length; index += 1) {
            expect(seen[index]).toBeGreaterThanOrEqual(seen[index - 1])
        }
        revoke(result.output?.url)
    })
})
