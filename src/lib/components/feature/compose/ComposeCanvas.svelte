<script lang="ts">
import { onMount } from "svelte"
import "@xyflow/svelte/dist/style.css"
import type { Connection, Edge, Node, NodeTypes, OnDelete, OnSelectionChange } from "@xyflow/svelte"
import { add_compose_edge, compose_state, compose_view, remove_compose_nodes } from "$lib/media/compose-state.svelte"
import type { ComposeEdge, ComposeNode, ComposePosition } from "$lib/media/compose-types"

async function load_flow() {
    const [lib, source, trim, transition, merge, subtitles, output] = await Promise.all([
        import("@xyflow/svelte"),
        import("./nodes/ComposeSourceHost.svelte"),
        import("./nodes/ComposeTrimHost.svelte"),
        import("./nodes/ComposeTransitionHost.svelte"),
        import("./nodes/ComposeMergeHost.svelte"),
        import("./nodes/ComposeSubtitlesHost.svelte"),
        import("./nodes/ComposeOutputHost.svelte"),
    ])
    return {
        SvelteFlow: lib.SvelteFlow,
        Controls: lib.Controls,
        node_types: {
            source: source.default,
            trim: trim.default,
            transition: transition.default,
            merge: merge.default,
            subtitles: subtitles.default,
            output: output.default,
        } satisfies NodeTypes,
    }
}

let flow = $state<Awaited<ReturnType<typeof load_flow>> | null>(null)

// WHY dynamic import: @xyflow/svelte needs browser APIs, static import breaks prerender — see AGENTS.md
onMount(async () => {
    flow = await load_flow()
})

function to_flow_node(node: ComposeNode): Node {
    return {
        id: node.id,
        type: node.type,
        position: { x: node.position.x, y: node.position.y },
        data: { ...node.data },
        deletable: true,
        selected: node.id === compose_state.selected_id,
    }
}

function to_flow_edge(edge: ComposeEdge): Edge {
    return {
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
        deletable: true,
        selected: edge.id === compose_state.selected_edge_id,
    }
}

let flow_nodes = $derived(compose_state.nodes.map(to_flow_node))
let flow_edges = $derived(compose_state.edges.map(to_flow_edge))

function handle_connect(connection: Connection): void {
    const result = add_compose_edge(connection)
    if (!result.ok) {
        compose_state.run_error = result.error
    } else if (compose_state.run_status !== "running") {
        compose_state.run_error = null
    }
}

function is_valid_preview(connection: Connection): boolean {
    const source = connection.source ?? null
    const target = connection.target ?? null
    if (!source || !target || source === target) {
        return false
    }
    const source_handle = connection.sourceHandle ?? null
    const target_handle = connection.targetHandle ?? null
    const by_id = new Map(compose_state.nodes.map((node) => [node.id, node]))
    const target_node = by_id.get(target)
    if (!by_id.has(source) || !target_node) {
        return false
    }
    const duplicate = compose_state.edges.some(
        (edge) =>
            edge.source === source &&
            (edge.sourceHandle ?? null) === source_handle &&
            edge.target === target &&
            (edge.targetHandle ?? null) === target_handle,
    )
    if (duplicate) {
        return false
    }
    const incoming = compose_state.edges.filter((edge) => edge.target === target)
    switch (target_node.type) {
        case "source":
            return false
        case "trim":
        case "subtitles":
        case "output":
            return incoming.length < 1
        case "transition":
            if (target_handle !== "a" && target_handle !== "b") {
                return false
            }
            if (incoming.some((edge) => (edge.targetHandle ?? null) === target_handle)) {
                return false
            }
            return incoming.length < 2
        case "merge": {
            if (target_handle === null || !/^in\d+$/.test(target_handle)) {
                return false
            }
            if (incoming.some((edge) => (edge.targetHandle ?? null) === target_handle)) {
                return false
            }
            const index = Number(target_handle.slice(2))
            return Number.isInteger(index) && index >= 0 && index < target_node.data.input_count
        }
    }
}

function handle_selection_change(selection: Parameters<OnSelectionChange>[0]): void {
    if (selection.edges.length > 0) {
        compose_state.selected_edge_id = selection.edges[0].id
        compose_state.selected_id = null
    } else {
        compose_state.selected_id = selection.nodes.length > 0 ? selection.nodes[0].id : null
        compose_state.selected_edge_id = null
    }
}

function handle_delete(deleted: Parameters<OnDelete>[0]): void {
    const nodes = deleted?.nodes ?? []
    const edges = deleted?.edges ?? []
    if (nodes.length > 0) {
        remove_compose_nodes(nodes.map((node) => node.id))
    }
    if (edges.length > 0) {
        const edge_ids = new Set(edges.map((edge) => edge.id))
        compose_state.edges = compose_state.edges.filter((edge) => !edge_ids.has(edge.id))
        if (compose_state.selected_edge_id !== null && edge_ids.has(compose_state.selected_edge_id)) {
            compose_state.selected_edge_id = null
        }
    }
}

function handle_nodes_drag_stop(event: { nodes: { id: string; position: ComposePosition }[] }): void {
    for (const moved of event.nodes) {
        const node = compose_state.nodes.find((candidate) => candidate.id === moved.id)
        if (node !== undefined) {
            node.position = { x: moved.position.x, y: moved.position.y }
        }
    }
}

function handle_move(_event: unknown, viewport: { x: number; y: number; zoom: number }): void {
    compose_view.x = viewport.x
    compose_view.y = viewport.y
    compose_view.zoom = viewport.zoom
}
</script>

<div
    class="compose-canvas h-[calc(100vh-320px)] min-h-[420px] w-full rounded-lg border border-gray-300 bg-gray-50"
    bind:clientWidth={compose_view.width}
    bind:clientHeight={compose_view.height}
>
    {#if flow !== null}
        {@const SvelteFlow = flow.SvelteFlow}
        {@const Controls = flow.Controls}
        <SvelteFlow
            nodes={flow_nodes}
            edges={flow_edges}
            nodeTypes={flow.node_types}
            fitView
            snapGrid={[15, 15]}
            deleteKey={["Backspace", "Delete"]}
            connectionRadius={28}
            isValidConnection={is_valid_preview}
            onconnect={handle_connect}
            onselectionchange={handle_selection_change}
            ondelete={handle_delete}
            onnodedragstop={handle_nodes_drag_stop}
            onmove={handle_move}
        >
            <Controls />
        </SvelteFlow>
    {:else}
        <p class="py-8 text-center text-sm text-gray-500">Loading canvas...</p>
    {/if}
</div>

<style>
.compose-canvas :global(.svelte-flow__node.svelte-flow__node-output) {
    width: auto;
    padding: 0;
    border: none;
    background: transparent;
    text-align: left;
}
.compose-canvas :global(.svelte-flow__handle) {
    width: 12px;
    height: 12px;
    min-width: 12px;
    min-height: 12px;
    border-width: 2px;
}
.compose-canvas :global(.svelte-flow__handle::after) {
    content: "";
    position: absolute;
    inset: -6px;
}
.compose-canvas :global(.svelte-flow__handle:hover),
.compose-canvas :global(.svelte-flow__handle.connectingfrom),
.compose-canvas :global(.svelte-flow__handle.connectionindicator) {
    box-shadow: 0 0 0 3px rgb(147 197 253 / 0.7);
}
.compose-canvas :global(.svelte-flow__handle.connectingto.valid) {
    box-shadow: 0 0 0 3px rgb(74 222 128 / 0.8);
}
.compose-canvas :global(.svelte-flow__handle.connectingto:not(.valid)) {
    box-shadow: 0 0 0 3px rgb(248 113 113 / 0.8);
}
</style>
