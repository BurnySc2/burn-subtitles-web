import type { ComposeEdge, ComposeNode } from "./compose-types"
import type { ProbeResult } from "./mediabunny-clip"

export type ComposeRunStatus = "idle" | "running" | "done" | "error"

export interface ComposeResult {
    url: string
    mime: string
    ext: string
    sidecar_url: string | null
}

export interface ComposeState {
    nodes: ComposeNode[]
    edges: ComposeEdge[]
    selected_id: string | null
    run_status: ComposeRunStatus
    run_progress: number
    run_error: string | null
    result: ComposeResult | null
}

function initial_state(): ComposeState {
    return {
        nodes: [],
        edges: [],
        selected_id: null,
        run_status: "idle",
        run_progress: 0,
        run_error: null,
        result: null,
    }
}

export const compose_state: ComposeState = $state(initial_state())

const preview_urls = new Map<string, string>()

export function preview_url(node_id: string): string | null {
    return preview_urls.get(node_id) ?? null
}

export function upsert_probe(node_id: string, file: File, probe: ProbeResult | null, url: string): void {
    const previous = preview_urls.get(node_id)
    if (previous && previous !== url) {
        URL.revokeObjectURL(previous)
    }
    preview_urls.set(node_id, url)
    const node = compose_state.nodes.find((candidate) => candidate.id === node_id)
    if (node && node.type === "source") {
        node.data.file = file
        node.data.probe = probe
    } else if (!node) {
        compose_state.nodes.push({ id: node_id, type: "source", position: { x: 0, y: 0 }, data: { file, probe } })
    }
}

export function reset_compose(): void {
    if (compose_state.result) {
        URL.revokeObjectURL(compose_state.result.url)
        if (compose_state.result.sidecar_url) {
            URL.revokeObjectURL(compose_state.result.sidecar_url)
        }
    }
    compose_state.result = null
    compose_state.run_error = null
    compose_state.run_status = "idle"
    compose_state.run_progress = 0
}

export function revoke_all(): void {
    for (const url of preview_urls.values()) {
        URL.revokeObjectURL(url)
    }
    preview_urls.clear()
    if (compose_state.result) {
        URL.revokeObjectURL(compose_state.result.url)
        if (compose_state.result.sidecar_url) {
            URL.revokeObjectURL(compose_state.result.sidecar_url)
        }
    }
    const fresh = initial_state()
    compose_state.nodes = fresh.nodes
    compose_state.edges = fresh.edges
    compose_state.selected_id = fresh.selected_id
    compose_state.run_status = fresh.run_status
    compose_state.run_progress = fresh.run_progress
    compose_state.run_error = fresh.run_error
    compose_state.result = fresh.result
}
