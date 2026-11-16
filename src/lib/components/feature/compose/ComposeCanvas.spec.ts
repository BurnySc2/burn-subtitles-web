import { beforeEach, describe, expect, it } from "vitest"
import { render } from "vitest-browser-svelte"
import { compose_state, remove_compose_nodes, revoke_all } from "$lib/media/compose-state.svelte"
import type { ComposeEdge, ComposeNode } from "$lib/media/compose-types"
import ComposeCanvas from "./ComposeCanvas.svelte"

function trim_node(id: string): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start: 0, end: 1 } }
}

function edge(id: string, source: string, target: string): ComposeEdge {
    return { id, source, sourceHandle: null, target, targetHandle: null }
}

beforeEach(() => {
    revoke_all()
})

describe("ComposeCanvas", () => {
    it("mounts a canvas shell", async () => {
        const screen = await render(ComposeCanvas)
        expect(screen.container.querySelector(".compose-canvas")).not.toBeNull()
        await screen.unmount()
    })

    it("keeps node selection when an unrelated edge is deleted", async () => {
        compose_state.nodes = [trim_node("a"), trim_node("b"), trim_node("c")]
        compose_state.edges = [edge("e1", "a", "b"), edge("e2", "b", "c")]
        compose_state.selected_id = "a"
        compose_state.selected_edge_id = null
        compose_state.edges = compose_state.edges.filter((item) => item.id !== "e2")
        expect(compose_state.edges.map((item) => item.id)).toEqual(["e1"])
        expect(compose_state.selected_id).toBe("a")
    })

    it("deletes only the targeted edge and clears its selection", async () => {
        compose_state.nodes = [trim_node("a"), trim_node("b")]
        compose_state.edges = [edge("e1", "a", "b"), edge("e2", "a", "b")]
        compose_state.selected_edge_id = "e1"
        const doomed = new Set(["e1"])
        compose_state.edges = compose_state.edges.filter((item) => !doomed.has(item.id))
        if (compose_state.selected_edge_id !== null && doomed.has(compose_state.selected_edge_id)) {
            compose_state.selected_edge_id = null
        }
        expect(compose_state.edges.map((item) => item.id)).toEqual(["e2"])
        expect(compose_state.selected_edge_id).toBeNull()
        remove_compose_nodes(["a"])
        expect(compose_state.nodes.map((node) => node.id)).toEqual(["b"])
        expect(compose_state.edges).toEqual([])
    })
})
