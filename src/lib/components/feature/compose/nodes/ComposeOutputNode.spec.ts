import { beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import { compose_state, revoke_all } from "$lib/media/compose-state.svelte"
import type { ComposeNode } from "$lib/media/compose-types"
import ComposeOutputNode from "./ComposeOutputNode.svelte"

vi.mock("@xyflow/svelte", () => ({
    Handle: () => null,
    Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}))

// Mirrors the trim contract in ComposeOutputNode.svelte (oninput) and
// ComposeInspector.svelte (patch_output_name): blank trims to null.
function normalize_file_name(value: string): string | null {
    return value.trim() === "" ? null : value.trim()
}

function output_node(): ComposeNode {
    return {
        id: "out",
        type: "output",
        position: { x: 0, y: 0 },
        data: { file_name: null, width: 1280, height: 720, fps: 30, quality: "medium" },
    }
}

function selected_file_name(): string | null {
    const found = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    return found && found.type === "output" ? found.data.file_name : null
}

function patch_output_name(file_name: string): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node && node.type === "output") {
        Object.assign(node.data, { file_name: normalize_file_name(file_name) })
    }
}

beforeEach(() => {
    revoke_all()
})

describe("ComposeOutputNode file name", () => {
    it.each([
        ["   ", null],
        ["  a.mp4  ", "a.mp4"],
    ] as Array<[string, string | null]>)("trims %j to %j", (raw, want) => {
        expect(normalize_file_name(raw)).toBe(want)
    })

    it("applies the trim contract to the selected output node", () => {
        compose_state.nodes = [output_node()]
        compose_state.edges = []
        compose_state.selected_id = "out"
        patch_output_name("   ")
        expect(selected_file_name()).toBeNull()
        patch_output_name("  a.mp4  ")
        expect(selected_file_name()).toBe("a.mp4")
    })
})

describe("ComposeOutputNode quality controls", () => {
    it("shows Quality and Audio quality selects with no CRF input", async () => {
        const screen = await render(ComposeOutputNode, {
            id: "out",
            data: { file_name: null, width: 1280, height: 720, fps: 30, quality: "medium" },
            update_data: vi.fn(),
        })
        expect(screen.container.querySelector("#out-quality")).not.toBeNull()
        expect(screen.container.querySelector("#out-audio-quality")).not.toBeNull()
        expect(screen.container.querySelector("[id*='crf' i]")).toBeNull()
        expect(screen.container.textContent).not.toMatch(/crf/i)
    })
})
