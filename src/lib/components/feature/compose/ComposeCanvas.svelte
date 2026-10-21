<script lang="ts">
import { onMount } from "svelte"
import "@xyflow/svelte/dist/style.css"
import type { Connection, Edge, Node, NodeTypes, OnDelete, OnSelectionChange } from "@xyflow/svelte"
import { compose_state, compose_view, remove_compose_nodes } from "$lib/media/compose-state.svelte"
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
    compose_state.edges.push({
        id: crypto.randomUUID(),
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: connection.targetHandle,
    })
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
</style>
