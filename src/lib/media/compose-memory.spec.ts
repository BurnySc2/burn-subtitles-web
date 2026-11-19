import { describe, expect, it } from "vitest"
import type { FusedDispatch } from "./compose-fused"
import {
    build_downstream_refcounts,
    build_fused_canonical,
    drain_consumed_predecessors,
    take_final,
} from "./compose-memory"
import type { ComposeEdge } from "./compose-types"
import type { StackSegment } from "./mediabunny-compose-stack"

function edge(id: string, source: string, target: string): ComposeEdge {
    return { id, source, sourceHandle: null, target, targetHandle: null }
}

function incoming_of(edges: ComposeEdge[]): Map<string, ComposeEdge[]> {
    const incoming = new Map<string, ComposeEdge[]>()
    for (const item of edges) {
        const list = incoming.get(item.target) ?? []
        list.push(item)
        incoming.set(item.target, list)
    }
    return incoming
}

function blob(): Blob {
    return new Blob(["frame"], { type: "video/mp4" })
}

function fused_entry(fused_ids: string[], end_id: string): FusedDispatch {
    const segment: StackSegment = {
        head_id: null,
        node_ids: [...fused_ids],
        terminal_rescale_id: null,
        fast_path: false,
    }
    return { segment, end_id, fused_ids: new Set(fused_ids), span: fused_ids.length }
}

const identity = (id: string): string => id

describe("build_downstream_refcounts", () => {
    it("counts one consumer per producer on a linear chain", () => {
        const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")]
        expect(build_downstream_refcounts(edges, new Set(["a", "b", "c"]), identity)).toEqual(
            new Map([
                ["a", 1],
                ["b", 1],
            ]),
        )
    })

    it("counts fan-out consumers for a diamond", () => {
        const edges = [edge("e1", "a", "b"), edge("e2", "a", "c"), edge("e3", "b", "d"), edge("e4", "c", "d")]
        expect(build_downstream_refcounts(edges, new Set(["a", "b", "c", "d"]), identity)).toEqual(
            new Map([
                ["a", 2],
                ["b", 1],
                ["c", 1],
            ]),
        )
    })

    it("counts each merge producer once for a 3-fan-in", () => {
        const edges = [edge("e1", "a", "m"), edge("e2", "b", "m"), edge("e3", "c", "m")]
        expect(build_downstream_refcounts(edges, new Set(["a", "b", "c", "m"]), identity)).toEqual(
            new Map([
                ["a", 1],
                ["b", 1],
                ["c", 1],
            ]),
        )
    })

    it("ignores edges with an endpoint outside live_ids", () => {
        const edges = [edge("e1", "a", "b"), edge("e2", "b", "stray")]
        expect(build_downstream_refcounts(edges, new Set(["a", "b"]), identity)).toEqual(new Map([["a", 1]]))
    })

    it("merges fused aliases into the end id and skips internal edges", () => {
        const edges = [edge("e1", "src", "t1"), edge("e2", "t1", "t2"), edge("e3", "t2", "out")]
        const canonical = (id: string): string => (id === "t1" || id === "t2" ? "t2" : id)
        expect(build_downstream_refcounts(edges, new Set(["src", "t1", "t2", "out"]), canonical)).toEqual(
            new Map([
                ["src", 1],
                ["t2", 1],
            ]),
        )
    })
})

describe("drain_consumed_predecessors", () => {
    it("drains a linear chain down to one live entry", () => {
        const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")]
        const remaining = build_downstream_refcounts(edges, new Set(["a", "b", "c"]), identity)
        const memo = new Map([
            ["a", blob()],
            ["b", blob()],
        ])
        expect(drain_consumed_predecessors("b", incoming_of(edges), memo, remaining, identity, new Set())).toEqual([
            "a",
        ])
        expect([...memo.keys()]).toEqual(["b"])
        expect(remaining.get("a")).toBe(0)
    })

    it("keeps diamond fan-out source until the Kth consumer drains", () => {
        const edges = [edge("e1", "a", "b"), edge("e2", "a", "c")]
        const remaining = build_downstream_refcounts(edges, new Set(["a", "b", "c"]), identity)
        const memo = new Map([["a", blob()]])
        const incoming = incoming_of(edges)
        expect(drain_consumed_predecessors("b", incoming, memo, remaining, identity, new Set())).toEqual([])
        expect(memo.has("a")).toBe(true)
        expect(drain_consumed_predecessors("c", incoming, memo, remaining, identity, new Set())).toEqual(["a"])
        expect(memo.has("a")).toBe(false)
    })

    it("decrements each merge producer once on a 3-fan-in", () => {
        const edges = [edge("e1", "a", "m"), edge("e2", "b", "m"), edge("e3", "c", "m")]
        const remaining = build_downstream_refcounts(edges, new Set(["a", "b", "c", "m"]), identity)
        const memo = new Map([
            ["a", blob()],
            ["b", blob()],
            ["c", blob()],
        ])
        const deleted = drain_consumed_predecessors("m", incoming_of(edges), memo, remaining, identity, new Set())
        expect(new Set(deleted)).toEqual(new Set(["a", "b", "c"]))
        expect(memo.size).toBe(0)
    })

    it("deletes a fused group atomically when its end id hits zero", () => {
        const edges = [edge("e1", "src", "t1"), edge("e2", "t1", "t2"), edge("e3", "t2", "out")]
        const live = new Set(["src", "t1", "t2", "out"])
        const canonical = (id: string): string => (id === "t1" || id === "t2" ? "t2" : id)
        const remaining = build_downstream_refcounts(edges, live, canonical)
        const memo = new Map([
            ["t1", blob()],
            ["t2", blob()],
        ])
        const deleted = drain_consumed_predecessors("out", incoming_of(edges), memo, remaining, canonical, new Set())
        expect(new Set(deleted)).toEqual(new Set(["t1", "t2"]))
        expect(memo.size).toBe(0)
    })

    it("never deletes retain_ids", () => {
        const edges = [edge("e1", "a", "b")]
        const remaining = build_downstream_refcounts(edges, new Set(["a", "b"]), identity)
        const memo = new Map([["a", blob()]])
        expect(drain_consumed_predecessors("b", incoming_of(edges), memo, remaining, identity, new Set(["a"]))).toEqual(
            [],
        )
        expect(memo.has("a")).toBe(true)
        expect(remaining.get("a")).toBe(0)
    })
})

describe("take_final", () => {
    it("clears everything except the final entry", () => {
        const final = blob()
        const memo = new Map<string, Blob>([
            ["a", blob()],
            ["out", final],
        ])
        expect(take_final(memo, "out")).toBe(final)
        expect([...memo.keys()]).toEqual(["out"])
    })

    it("returns null and clears when the final id is missing", () => {
        const memo = new Map<string, Blob>([["a", blob()]])
        expect(take_final(memo, "out")).toBeNull()
        expect(memo.size).toBe(0)
    })
})

describe("build_fused_canonical", () => {
    it("maps fused ids to the end id and leaves others alone", () => {
        const dispatch = new Map([["t1", fused_entry(["t1", "t2"], "t2")]])
        const canonical = build_fused_canonical(dispatch)
        expect(canonical("t1")).toBe("t2")
        expect(canonical("t2")).toBe("t2")
        expect(canonical("src")).toBe("src")
    })

    it("returns identity for an empty dispatch", () => {
        expect(build_fused_canonical(new Map())("any")).toBe("any")
    })
})
