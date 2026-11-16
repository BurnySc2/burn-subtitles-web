<script lang="ts">
import { first_dropped_file } from "$lib/media/compose-drop"
import { handle_accepted_file } from "$lib/media/compose-file-handler"
import { clear_preview_url, compose_state, set_source_file, set_source_probe } from "$lib/media/compose-state.svelte"
import type { ComposeNode } from "$lib/media/compose-types"
import { compose_node_title } from "$lib/media/compose-types"
import { probe_media } from "$lib/media/mediabunny-clip"

type MediaNode = Extract<ComposeNode, { type: "source" | "overlay" | "subtitles" }>

function is_media_node(node: ComposeNode): node is MediaNode {
    return node.type === "source" || node.type === "overlay" || node.type === "subtitles"
}

let media_nodes = $derived(compose_state.nodes.filter(is_media_node))
let drag_id = $state<string | null>(null)

const row_tokens = new Map<string, { n: number }>()

function token_for(node_id: string): { n: number } {
    let token = row_tokens.get(node_id)
    if (!token) {
        token = { n: 0 }
        row_tokens.set(node_id, token)
    }
    return token
}

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

async function drop_on_row(event: DragEvent, node: MediaNode): Promise<void> {
    event.preventDefault()
    drag_id = null
    const file = first_dropped_file(event)
    if (!file) {
        return
    }
    const target_file: File = file
    const node_id = node.id
    await handle_accepted_file({
        file: target_file,
        kind: node.type,
        token: token_for(node_id),
        on_accept: async (mine) => {
            const target = compose_state.nodes.find((candidate) => candidate.id === node_id)
            if (!target) {
                return
            }
            if (target.type === "source") {
                const url = URL.createObjectURL(target_file)
                set_source_file(node_id, target_file, url)
                try {
                    const probe = await probe_media(target_file)
                    if (mine !== token_for(node_id).n) {
                        return
                    }
                    set_source_probe(node_id, target_file, probe)
                } catch {
                    if (mine !== token_for(node_id).n) {
                        return
                    }
                    clear_preview_url(node_id)
                    const current = compose_state.nodes.find((candidate) => candidate.id === node_id)
                    if (current && current.type === "source") {
                        current.data.file = null
                        current.data.probe = null
                    }
                }
            } else if (target.type === "overlay") {
                target.data.image = target_file
                try {
                    const { probe_image } = await import("$lib/media/mediabunny-overlay")
                    await probe_image(target_file)
                } catch {
                    if (mine !== token_for(node_id).n) {
                        return
                    }
                    const current = compose_state.nodes.find((candidate) => candidate.id === node_id)
                    if (current && current.type === "overlay" && current.data.image === target_file) {
                        current.data.image = null
                    }
                }
            } else if (target.type === "subtitles") {
                target.data.file = target_file
            }
        },
        on_reject: () => undefined,
    })
}
</script>

<div class="flex w-full flex-col gap-1 rounded-lg bg-gray-100 p-2">
    {#if media_nodes.length === 0}
        <p class="px-1 py-2 text-xs text-gray-500">Add source, then attach file in Inspector</p>
    {:else}
        <ul class="flex flex-col gap-1">
            {#each media_nodes as node (node.id)}
                {@const file = attached_file(node)}
                {@const name = display_name(node)}
                <li
                    class="rounded"
                    class:ring-2={drag_id === node.id}
                    class:ring-blue-500={drag_id === node.id}
                    ondragover={(e) => {
                        e.preventDefault()
                        drag_id = node.id
                    }}
                    ondragleave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
                            return
                        }
                        if (drag_id === node.id) {
                            drag_id = null
                        }
                    }}
                    ondrop={(e) => {
                        void drop_on_row(e, node)
                    }}
                >
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
