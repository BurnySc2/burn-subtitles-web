import { beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import { compose_state, parse_compose_json, revoke_all, serialize_compose } from "$lib/media/compose-state.svelte"
import type { ComposeEdge, ComposeNode } from "$lib/media/compose-types"
import ComposeJsonBar from "./ComposeJsonBar.svelte"

function trim_node(id: string): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start: 0, end: 1 } }
}

function edge(id: string, source: string, target: string): ComposeEdge {
    return { id, source, sourceHandle: null, target, targetHandle: null }
}

function set_files(files: FileList | File[], input: HTMLInputElement): void {
    const transfer = new DataTransfer()
    const list = Array.isArray(files) ? files : [...files]
    for (const file of list) {
        transfer.items.add(file)
    }
    Object.defineProperty(input, "files", { value: transfer.files, configurable: true })
}

beforeEach(() => {
    revoke_all()
})

describe("ComposeJsonBar", () => {
    it("round-trips graph via JSON and drops live file/probe", async () => {
        const file = new File(["x"], "clip.mp4", { type: "video/mp4" })
        const source: ComposeNode = {
            id: "src",
            type: "source",
            position: { x: 10, y: 20 },
            data: { file, probe: { file_name: "clip.mp4" } as never },
        }
        const json = serialize_compose([source, trim_node("trim")], [edge("e1", "src", "trim")])
        expect(json).not.toContain("clip.mp4-x")
        const parsed = parse_compose_json(json)
        expect(parsed.nodes.map((node) => node.id).sort()).toEqual(["src", "trim"])
        expect(parsed.edges.map((edge_item) => edge_item.id)).toEqual(["e1"])
        const parsed_source = parsed.nodes.find((node) => node.id === "src")
        expect(parsed_source?.type).toBe("source")
        if (parsed_source?.type === "source") {
            expect(parsed_source.data.file).toBeNull()
            expect(parsed_source.data.probe).toBeNull()
        }
    })

    it("imports valid JSON and replaces the graph", async () => {
        compose_state.nodes = [trim_node("old")]
        const screen = await render(ComposeJsonBar)
        const json = serialize_compose([trim_node("next")], [])
        const file = new File([json], "graph.json", { type: "application/json" })
        const input = screen.container.querySelector('input[type="file"]') as HTMLInputElement
        set_files([file], input)
        input.dispatchEvent(new Event("change", { bubbles: true }))
        await vi.waitFor(() => expect(compose_state.nodes.map((node) => node.id)).toEqual(["next"]))
        expect(screen.container.querySelector("p")).toBeNull()
        await screen.unmount()
    })

    it("keeps the graph and shows an error for invalid JSON", async () => {
        compose_state.nodes = [trim_node("keep")]
        const screen = await render(ComposeJsonBar)
        const file = new File(["{not json"], "bad.json", { type: "application/json" })
        const input = screen.container.querySelector('input[type="file"]') as HTMLInputElement
        set_files([file], input)
        input.dispatchEvent(new Event("change", { bubbles: true }))
        await vi.waitFor(() => expect(screen.container.querySelector("p")?.textContent).toMatch(/not valid JSON/i))
        expect(compose_state.nodes.map((node) => node.id)).toEqual(["keep"])
        await screen.unmount()
    })
})
