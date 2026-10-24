<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { first_dropped_file, is_accepted } from "$lib/media/compose-drop"
import { set_source_file, set_source_probe } from "$lib/media/compose-state.svelte"
import { compose_node_title, type SourceNodeData } from "$lib/media/compose-types"
import { ClipError, probe_media } from "$lib/media/mediabunny-clip"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: SourceNodeData
    update_data: (patch: Partial<SourceNodeData>) => void
} = $props()

let file_input = $state<HTMLInputElement | null>(null)
let probing = $state(false)
let error = $state<string | null>(null)
let is_dragging = $state(false)
let token = 0
let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("source", data.label))
let has_file = $derived(data.file !== null)
let choose_label = $derived(has_file ? "Replace file" : "Choose file")
let choose_aria = $derived(has_file ? "Replace source file" : "Choose source file")

let probe_line = $derived.by(() => {
    const probe = data.probe
    if (!probe) {
        return data.file ? data.file.name : "No file selected"
    }
    const parts: string[] = []
    if (data.file) {
        parts.push(data.file.name)
    }
    if (probe.duration !== null) {
        parts.push(`${probe.duration.toFixed(2)}s`)
    }
    if (probe.display_width !== null && probe.display_height !== null) {
        parts.push(`${probe.display_width}x${probe.display_height}`)
    }
    return parts.length > 0 ? parts.join(" · ") : "No file selected"
})

async function handle_file(file: File | null): Promise<void> {
    if (!file || !id) {
        return
    }
    if (!is_accepted(file, "source")) {
        token += 1
        update_data({ file: null, probe: null })
        error = "Please select a video or audio file."
        probing = false
        return
    }
    const mine = ++token
    probing = true
    error = null
    update_data({ file, probe: null })
    const url = URL.createObjectURL(file)
    set_source_file(id, file, url)
    try {
        const probe = await probe_media(file)
        if (mine !== token) {
            return
        }
        set_source_probe(id, file, probe)
    } catch (caught) {
        if (mine !== token) {
            return
        }
        error = caught instanceof ClipError ? caught.message : `Failed to read media: ${(caught as Error).message}`
    } finally {
        if (mine === token) {
            probing = false
        }
    }
}
</script>

<div
    class="min-w-48 max-w-64 overflow-hidden rounded-lg border border-gray-300 bg-white p-3"
    data-testid="compose-node"
    data-kind="source"
>
    <Handle
        type="source"
        position={Position.Right}
    />
    <p
        class="text-sm font-medium"
        ondblclick={() => {
            label_draft = data.label ?? ""
            editing_label = true
        }}
        title="Double-click to rename"
    >
        {title}
    </p>
    {#if editing_label}
        <input
            type="text"
            value={label_draft}
            placeholder="Name (optional)"
            aria-label="Node name (optional)"
            oninput={(e) => {
                label_draft = e.currentTarget.value
            }}
            onblur={() => {
                update_data({ label: label_draft.trim() === "" ? null : label_draft.trim() })
                editing_label = false
            }}
            onkeydown={(e) => {
                if (e.key === "Enter") {
                    update_data({ label: label_draft.trim() === "" ? null : label_draft.trim() })
                    editing_label = false
                } else if (e.key === "Escape") {
                    editing_label = false
                }
            }}
            class="nodrag mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
    {/if}
    <p
        aria-live="polite"
        class="mt-1 block w-full min-w-0 max-w-full truncate text-xs text-gray-600"
        title={probe_line}
    >
        {probe_line}
    </p>
    {#if probing}
        <p class="mt-1 text-xs text-gray-500">Reading media…</p>
    {:else if error}
        <p class="mt-1 text-xs text-red-700">{error}</p>
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions: inner button/input is the keyboard path; drop is enhancement only, so no role=button -->
    <div
        class="drop-zone nodrag mt-2 w-full"
        class:drag-over={is_dragging}
        ondragover={(e) => {
            e.preventDefault()
            e.stopPropagation()
            is_dragging = true
        }}
        ondragleave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
                return
            }
            is_dragging = false
        }}
        ondrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            is_dragging = false
            void handle_file(first_dropped_file(e))
        }}
    >
        <input
            id={id ? `${id}-file` : undefined}
            bind:this={file_input}
            type="file"
            accept="video/*,audio/*"
            class="nodrag hidden"
            onchange={(e) => {
                const file = e.currentTarget.files?.[0] ?? null
                e.currentTarget.value = ""
                void handle_file(file)
            }}
        >
        <button
            type="button"
            onclick={() => file_input?.click()}
            aria-label={choose_aria}
            class="btn btn-primary btn-sm nodrag mt-2"
        >
            {choose_label}
        </button>
        {#if data.file}
            <button
                type="button"
                onclick={() => {
                    token += 1
                    probing = false
                    error = null
                    // WHY orphan URL: preview_urls is private, next set_source_file revokes it
                    update_data({ file: null, probe: null })
                }}
                aria-label={`Remove source file ${data.file.name}`}
                class="btn btn-sm nodrag mt-1 bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
            >
                Remove
            </button>
        {/if}
    </div>
</div>
