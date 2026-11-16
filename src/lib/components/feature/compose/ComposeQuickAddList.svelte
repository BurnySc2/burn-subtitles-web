<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { ComposeNode } from "$lib/media/compose-types"
import { compose_node_title } from "$lib/media/compose-types"

type MediaNode = Extract<ComposeNode, { type: "source" | "overlay" | "subtitles" }>

function is_media_node(node: ComposeNode): node is MediaNode {
    return node.type === "source" || node.type === "overlay" || node.type === "subtitles"
}

let media_nodes = $derived(compose_state.nodes.filter(is_media_node))

function attached_file(node: MediaNode): File | null {
    return node.type === "overlay" ? node.data.image : node.data.file
}

function display_name(node: MediaNode): string {
    return attached_file(node)?.name ?? compose_node_title(node.type, node.data.label)
}

function select_node(node_id: string): void {
    compose_state.selected_id = node_id
    compose_state.selected_edge_id = null
}
</script>

<div class="flex w-full flex-col gap-1 rounded-lg bg-gray-100 p-2">
    {#if media_nodes.length === 0}
        <p class="px-1 py-2 text-xs text-gray-500">Add source, then attach file in Inspector</p>
    {:else}
        <ul class="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {#each media_nodes as node (node.id)}
                {@const file = attached_file(node)}
                {@const name = display_name(node)}
                <li>
                    <button
                        type="button"
                        onclick={() => select_node(node.id)}
                        aria-current={compose_state.selected_id === node.id}
                        title={name}
                        class="btn btn-secondary btn-sm flex w-full items-center gap-1 truncate text-left"
                    >
                        <span
                            aria-hidden="true"
                            class={file ? "text-green-700" : "text-gray-400"}
                            >{file ? "✓" : "○"}</span
                        >
                        <span class="min-w-0 flex-1 truncate text-xs">{name}</span>
                        <span class="rounded bg-gray-200 px-1 text-[10px] uppercase">{node.type}</span>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>
