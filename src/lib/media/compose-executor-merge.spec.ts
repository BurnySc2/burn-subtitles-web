import { beforeEach, describe, expect, it, vi } from "vitest"
import { execute_compose_graph } from "./compose-executor"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { extract_clip } from "./mediabunny-clip"
import { render_merge } from "./mediabunny-merge"
import { render_transition } from "./mediabunny-transition"

vi.mock("./mediabunny-clip", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-clip")>()
    return { ...actual, extract_clip: vi.fn(), probe_media: vi.fn() }
})

vi.mock("./mediabunny-merge", () => ({ render_merge: vi.fn() }))

vi.mock("./mediabunny-transition", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-transition")>()
    return { ...actual, render_transition: vi.fn() }
})

const mp4_blob = (text: string): Blob => new Blob([text], { type: "video/mp4" })

const mp4_file = (name: string): File => new File([`${name}-bytes`], name, { type: "video/mp4" })

const srt_content = "1\n00:00:01,000 --> 00:00:02,000\nHi\n"

function source(id: string): ComposeNode {
    return { id, type: "source", position: { x: 0, y: 0 }, data: { file: mp4_file(`${id}.mp4`), probe: null } }
}

function trim(id: string, start = 10, end = 20): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start, end } }
}

function merge(id: string, input_count = 2): ComposeNode {
    return { id, type: "merge", position: { x: 0, y: 0 }, data: { input_count } }
}

function subtitles(id: string, mode: "mux" | "sidecar" = "sidecar"): ComposeNode {
    return {
        id,
        type: "subtitles",
        position: { x: 0, y: 0 },
        data: { file: null, content: srt_content, mode },
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

function edge(id: string, from: string, to: string, targetHandle: string | null = null): ComposeEdge {
    return { id, source: from, sourceHandle: null, target: to, targetHandle }
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

beforeEach(() => {
    vi.mocked(extract_clip).mockReset()
    vi.mocked(render_merge).mockReset()
    vi.mocked(render_transition).mockReset()
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
})

describe("execute_compose_graph merge order", () => {
    it("keeps in0,in1 order even when the b branch finishes first", async () => {
        vi.mocked(extract_clip).mockImplementation(async (options) => {
            if (options.file.name === "a.mp4") {
                await delay(30)
                return {
                    blob: mp4_blob("branch-a"),
                    extension: "mp4",
                    mime: "video/mp4",
                    cancel: () => Promise.resolve(),
                }
            }
            return {
                blob: mp4_blob("branch-b"),
                extension: "mp4",
                mime: "video/mp4",
                cancel: () => Promise.resolve(),
            }
        })
        const result = await execute_compose_graph({
            nodes: [source("a"), source("b"), trim("ta"), trim("tb"), merge("m"), output()],
            edges: [
                edge("e1", "a", "ta"),
                edge("e2", "b", "tb"),
                edge("e3", "tb", "m", "in1"),
                edge("e4", "ta", "m", "in0"),
                edge("e5", "m", "out"),
            ],
        })
        expect(result.ok).toBe(true)
        expect(vi.mocked(extract_clip)).toHaveBeenCalledTimes(2)
        const call = vi.mocked(render_merge).mock.calls[0]?.[0]
        expect(call?.files).toHaveLength(2)
        const texts = [await call?.files[0].text(), await call?.files[1].text()]
        expect(texts).toEqual(["branch-a", "branch-b"])
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })
})

describe("execute_compose_graph vtt sidecar", () => {
    it.each([
        { mode: "sidecar" as const, expect_sidecar: true },
        { mode: "mux" as const, expect_sidecar: false },
    ])("emits sidecar_url only for sidecar subtitles (mode=$mode)", async ({ mode, expect_sidecar }) => {
        const result = await execute_compose_graph({
            nodes: [source("s"), subtitles("sub", mode), output()],
            edges: [edge("e1", "s", "sub"), edge("e2", "sub", "out")],
        })
        expect(result.ok).toBe(true)
        if (expect_sidecar) {
            expect(result.output?.sidecar_url?.startsWith("blob:")).toBe(true)
            const sidecar_text = await (await fetch(result.output?.sidecar_url as string)).text()
            expect(sidecar_text).toContain("WEBVTT")
            if (result.output?.sidecar_url) {
                URL.revokeObjectURL(result.output.sidecar_url)
            }
        } else {
            expect(result.output?.sidecar_url).toBeNull()
        }
        expect(vi.mocked(extract_clip)).not.toHaveBeenCalled()
        expect(vi.mocked(render_merge)).not.toHaveBeenCalled()
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })

    it("omits sidecar_url without a subtitles node", async () => {
        const result = await execute_compose_graph({
            nodes: [source("s"), trim("t"), output()],
            edges: [edge("e1", "s", "t"), edge("e2", "t", "out")],
        })
        expect(result.ok).toBe(true)
        expect(result.output?.sidecar_url).toBeNull()
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })
})
