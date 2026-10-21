<script lang="ts">
import { onMount } from "svelte"
import "@xyflow/svelte/dist/style.css"
import type { Connection, Edge, Node, NodeTypes, OnDelete, OnSelectionChange } from "@xyflow/svelte"
import { compose_state } from "$lib/media/compose-state.svelte"
import type { ComposeEdge, ComposeNode, ComposePosition } from "$lib/media/compose-types"

async function load_flow() {
    const [lib, source, trim, transition, subtitles, output] = await Promise.all([
        import("@xyflow/svelte"),
        import("./nodes/ComposeSourceHost.svelte"),
        import("./nodes/ComposeTrimHost.svelte"),
        import("./nodes/ComposeTransitionHost.svelte"),
        import("./nodes/ComposeSubtitlesHost.svelte"),
        import("./nodes/ComposeOutputHost.svelte"),
    ])
    return {
        SvelteFlow: lib.SvelteFlow,
        MiniMap: lib.MiniMap,
        Controls: lib.Controls,
        node_types: {
            source: source.default,
            trim: trim.default,
            transition: transition.default,
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
    }
}

function to_flow_edge(edge: ComposeEdge): Edge {
    return {
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
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
    compose_state.selected_id = selection.nodes.length > 0 ? selection.nodes[0].id : null
}

function handle_delete(deleted: Parameters<OnDelete>[0]): void {
    const node_ids = new Set(deleted.nodes.map((node) => node.id))
    const edge_ids = new Set(deleted.edges.map((edge) => edge.id))
    compose_state.nodes = compose_state.nodes.filter((node) => !node_ids.has(node.id))
    compose_state.edges = compose_state.edges.filter(
        (edge) => !edge_ids.has(edge.id) && !node_ids.has(edge.source) && !node_ids.has(edge.target),
    )
    if (compose_state.selected_id !== null && node_ids.has(compose_state.selected_id)) {
        compose_state.selected_id = null
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
</script>

<div class="h-[420px] w-full">
    {#if flow !== null}
        {@const SvelteFlow = flow.SvelteFlow}
        {@const MiniMap = flow.MiniMap}
        {@const Controls = flow.Controls}
        <SvelteFlow
            nodes={flow_nodes}
            edges={flow_edges}
            nodeTypes={flow.node_types}
            fitView
            snapGrid={[15, 15]}
            onconnect={handle_connect}
            onselectionchange={handle_selection_change}
            ondelete={handle_delete}
            onnodedragstop={handle_nodes_drag_stop}
        >
            <MiniMap />
            <Controls />
        </SvelteFlow>
    {:else}
        <p class="py-8 text-center text-sm text-gray-500">Loading canvas...</p>
    {/if}
</div>
