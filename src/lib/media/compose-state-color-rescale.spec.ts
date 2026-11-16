import { beforeEach, describe, expect, it } from "vitest"
import { add_compose_edge, compose_state, parse_compose_json, revoke_all } from "./compose-state.svelte"
import type { ComposeNode } from "./compose-types"

function source(id: string): ComposeNode {
    return { id, type: "source", position: { x: 0, y: 0 }, data: { file: null, probe: null } }
}

function color(id: string): ComposeNode {
    return { id, type: "color", position: { x: 0, y: 0 }, data: { color: "#000000", duration: 20 } }
}

function rescale(id: string): ComposeNode {
    return {
        id,
        type: "rescale",
        position: { x: 0, y: 0 },
        data: { width: 1920, height: 1080, fps: null, fit: "contain" },
    }
}

beforeEach(() => {
    revoke_all()
})

describe("compose-state color and rescale", () => {
    it("rejects edges into color and allows only one input into rescale", () => {
        compose_state.nodes = [source("a"), source("b"), color("c"), rescale("r")]
        compose_state.edges = []
        expect(add_compose_edge({ source: "a", sourceHandle: null, target: "c", targetHandle: null })).toEqual({
            ok: false,
            error: "Color nodes accept no inputs.",
        })
        expect(add_compose_edge({ source: "a", sourceHandle: null, target: "r", targetHandle: null })).toEqual({
            ok: true,
            error: null,
        })
        expect(add_compose_edge({ source: "b", sourceHandle: null, target: "r", targetHandle: null })).toEqual({
            ok: false,
            error: "Rescale nodes accept 1 input — remove the existing connection first.",
        })
    })

    it("applies color and rescale defaults when fields are omitted", () => {
        const raw = JSON.stringify({
            version: 1,
            nodes: [
                { id: "c", type: "color", position: { x: 0, y: 0 }, data: {} },
                { id: "r", type: "rescale", position: { x: 0, y: 0 }, data: {} },
            ],
            edges: [],
        })
        const parsed = parse_compose_json(raw)
        const color_node = parsed.nodes.find((node) => node.id === "c")
        const rescale_node = parsed.nodes.find((node) => node.id === "r")
        expect(color_node?.type).toBe("color")
        if (color_node?.type === "color") {
            expect(color_node.data.color).toBe("#000000")
            expect(color_node.data.duration).toBe(20)
        }
        expect(rescale_node?.type).toBe("rescale")
        if (rescale_node?.type === "rescale") {
            expect(rescale_node.data.width).toBe(1920)
            expect(rescale_node.data.height).toBe(1080)
            expect(rescale_node.data.fps).toBeNull()
            expect(rescale_node.data.fit).toBe("contain")
        }
    })

    it("rejects rescale fit cover and non-numeric fps", () => {
        const cover = JSON.stringify({
            version: 1,
            nodes: [{ id: "r", type: "rescale", position: { x: 0, y: 0 }, data: { fit: "cover" } }],
            edges: [],
        })
        expect(() => parse_compose_json(cover)).toThrow('rescale fit must be "contain"')
        const bad_fps = JSON.stringify({
            version: 1,
            nodes: [{ id: "r", type: "rescale", position: { x: 0, y: 0 }, data: { fps: "30" } }],
            edges: [],
        })
        expect(() => parse_compose_json(bad_fps)).toThrow("invalid rescale fps")
    })
})
