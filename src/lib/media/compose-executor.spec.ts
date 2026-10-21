import { beforeEach, describe, expect, it, vi } from "vitest"
import { execute_compose_graph } from "./compose-executor"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { extract_clip } from "./mediabunny-clip"
import { render_transition } from "./mediabunny-transition"

vi.mock("./mediabunny-clip", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-clip")>()
    return { ...actual, extract_clip: vi.fn() }
})

vi.mock("./mediabunny-transition", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mediabunny-transition")>()
    return { ...actual, render_transition: vi.fn() }
})

const mp4_blob = (text: string): Blob => new Blob([text], { type: "video/mp4" })

const mp4_file = (name: string): File => new File([`${name}-bytes`], name, { type: "video/mp4" })

function source(id: string): ComposeNode {
    return { id, type: "source", position: { x: 0, y: 0 }, data: { file: mp4_file(`${id}.mp4`), probe: null } }
}

function trim(id: string, start = 10, end = 20): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start, end } }
}

function transition(id: string, start = 0, duration = 1): ComposeNode {
    return { id, type: "transition", position: { x: 0, y: 0 }, data: { start, duration, easing: "linear" } }
}

function subtitles(id: string): ComposeNode {
    return {
        id,
        type: "subtitles",
        position: { x: 0, y: 0 },
        data: { file: null, content: "1\n00:00:01,000 --> 00:00:02,000\nHi\n", mode: "mux" },
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

beforeEach(() => {
    vi.mocked(extract_clip).mockReset()
    vi.mocked(render_transition).mockReset()
    vi.mocked(extract_clip).mockImplementation(async (options) => ({
        blob: mp4_blob(`trim-${options.start}-${options.end}`),
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

describe("execute_compose_graph validation gate", () => {
    it("returns issues without executing when the graph is invalid", async () => {
        const result = await execute_compose_graph({ nodes: [source("src")], edges: [] })
        expect(result.ok).toBe(false)
        expect(result.output).toBeNull()
        expect(result.issues.length).toBeGreaterThan(0)
        expect(vi.mocked(extract_clip)).not.toHaveBeenCalled()
        expect(vi.mocked(render_transition)).not.toHaveBeenCalled()
    })
})

describe("execute_compose_graph trim flow", () => {
    it("runs source to trim to output and reports monotonic progress", async () => {
        const seen: number[] = []
        const result = await execute_compose_graph({
            nodes: [source("src"), trim("trim"), output()],
            edges: [edge("e1", "src", "trim"), edge("e2", "trim", "out")],
            on_progress: (progress) => seen.push(progress),
        })
        expect(result.ok).toBe(true)
        expect(result.issues).toEqual([])
        expect(result.output?.mime).toBe("video/mp4")
        expect(result.output?.ext).toBe("mp4")
        expect(result.output?.size_bytes).toBeGreaterThan(0)
        expect(result.output?.url.startsWith("blob:")).toBe(true)
        const call = vi.mocked(extract_clip).mock.calls[0]?.[0]
        expect(call?.start).toBe(10)
        expect(call?.end).toBe(20)
        expect(call?.file).toBeInstanceOf(File)
        expect(vi.mocked(render_transition)).not.toHaveBeenCalled()
        expect(seen.length).toBe(3)
        expect(seen[seen.length - 1]).toBe(1)
        for (let index = 1; index < seen.length; index += 1) {
            expect(seen[index]).toBeGreaterThanOrEqual(seen[index - 1])
        }
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })
})

describe("execute_compose_graph transition flow", () => {
    it("renders a transition from both branches", async () => {
        const result = await execute_compose_graph({
            nodes: [source("a"), source("b"), transition("x"), output()],
            edges: [edge("e1", "a", "x", "a"), edge("e2", "b", "x", "b"), edge("e3", "x", "out")],
        })
        expect(result.ok).toBe(true)
        expect(result.output?.mime).toBe("video/mp4")
        const call = vi.mocked(render_transition).mock.calls[0]?.[0]
        expect(call?.duration).toBe(1)
        expect(call?.file_a).toBeInstanceOf(File)
        expect(call?.file_b).toBeInstanceOf(File)
        expect(call?.file_a.name).toBe("a.mp4")
        expect(call?.file_b.name).toBe("b.mp4")
        expect(vi.mocked(extract_clip)).not.toHaveBeenCalled()
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })
})

describe("execute_compose_graph subtitles flow", () => {
    it("passes video through after validating srt content", async () => {
        const result = await execute_compose_graph({
            nodes: [source("src"), subtitles("sub"), output()],
            edges: [edge("e1", "src", "sub"), edge("e2", "sub", "out")],
        })
        expect(result.ok).toBe(true)
        expect(result.output?.mime).toBe("video/mp4")
        expect(vi.mocked(extract_clip)).not.toHaveBeenCalled()
        expect(vi.mocked(render_transition)).not.toHaveBeenCalled()
        if (result.output) {
            URL.revokeObjectURL(result.output.url)
        }
    })

    it("rejects invalid srt content", async () => {
        const bad: ComposeNode = {
            id: "sub",
            type: "subtitles",
            position: { x: 0, y: 0 },
            data: { file: null, content: "not-a-subtitle", mode: "mux" },
        }
        const result = await execute_compose_graph({
            nodes: [source("src"), bad, output()],
            edges: [edge("e1", "src", "sub"), edge("e2", "sub", "out")],
        })
        expect(result.ok).toBe(false)
        expect(result.output).toBeNull()
        expect(result.issues.some((issue) => issue.field === "content")).toBe(true)
        expect(vi.mocked(extract_clip)).not.toHaveBeenCalled()
    })
})

describe("execute_compose_graph abort and cycles", () => {
    it("throws CANCELLED on a pre-aborted signal without executing", async () => {
        const controller = new AbortController()
        controller.abort()
        await expect(
            execute_compose_graph({
                nodes: [source("src"), trim("trim"), output()],
                edges: [edge("e1", "src", "trim"), edge("e2", "trim", "out")],
                signal: controller.signal,
            }),
        ).rejects.toMatchObject({ name: "ClipError", code: "CANCELLED" })
        expect(vi.mocked(extract_clip)).not.toHaveBeenCalled()
    })

    it("returns a cycle issue without executing on cyclic graphs", async () => {
        const nodes = [trim("t1"), trim("t2"), output()]
        const edges = [edge("e1", "t2", "t1"), edge("e2", "t1", "t2"), edge("e3", "t1", "out")]
        const result = await execute_compose_graph({ nodes, edges })
        expect(result.ok).toBe(false)
        expect(result.output).toBeNull()
        expect(result.issues).toContainEqual({
            node_id: null,
            field: "cycle",
            message: "Composition graph contains a cycle",
        })
        expect(vi.mocked(extract_clip)).not.toHaveBeenCalled()
        expect(vi.mocked(render_transition)).not.toHaveBeenCalled()
    })
})
