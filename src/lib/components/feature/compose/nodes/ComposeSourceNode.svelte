<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { onDestroy } from "svelte"
import ComposeFileDrop from "$lib/components/feature/compose/ComposeFileDrop.svelte"
import { handle_accepted_file } from "$lib/media/compose-file-handler"
import {
    compose_state,
    get_source_preview_url,
    release_source_preview_url,
    set_source_file,
    set_source_probe,
} from "$lib/media/compose-state.svelte"
import { compose_node_title, type SourceNodeData } from "$lib/media/compose-types"
import { ClipError, probe_media } from "$lib/media/mediabunny-clip"
import { format_audio_label } from "$lib/media/probe-audio-label"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: SourceNodeData
    update_data: (patch: Partial<SourceNodeData>) => void
} = $props()

let probing = $state(false)
let error = $state<string | null>(null)
let token = { n: 0 }

function release_preview(): void {
    if (!id || compose_state.run_status === "running") {
        return
    }
    release_source_preview_url(id)
}

let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("source", data.label))
let running = $derived(compose_state.run_status === "running")
let has_file = $derived(data.file !== null)
let choose_label = $derived(has_file ? "Replace file" : "Choose file")
let choose_aria = $derived(has_file ? "Replace source file" : "Choose source file")

let file_name = $derived(data.file ? data.file.name : "No file selected")
let meta_line = $derived.by(() => {
    const probe = data.probe
    if (!probe) {
        return ""
    }
    const parts: string[] = []
    if (probe.duration !== null) {
        parts.push(`${probe.duration.toFixed(2)}s`)
    }
    if (probe.display_width !== null && probe.display_height !== null) {
        parts.push(`${probe.display_width}x${probe.display_height}`)
    }
    if (probe.frame_rate !== null) {
        parts.push(`${probe.frame_rate.toFixed(2)} fps`)
    }
    const audio_label = format_audio_label(probe)
    if (audio_label) {
        parts.push(audio_label)
    }
    return parts.join(" · ")
})

async function handle_file(file: File | null): Promise<void> {
    if (compose_state.run_status === "running") {
        return
    }
    if (!file || !id) {
        return
    }
    const accepted: File = file
    const node_id: string = id
    await handle_accepted_file({
        file: accepted,
        kind: "source",
        token,
        on_accept: async (mine) => {
            probing = true
            error = null
            update_data({ file: accepted, probe: null })
            release_preview()
            set_source_file(node_id, accepted, get_source_preview_url(node_id, accepted))
            try {
                const probe = await probe_media(accepted)
                if (mine !== token.n) {
                    return
                }
                set_source_probe(node_id, accepted, probe)
            } catch (caught) {
                if (mine !== token.n) {
                    return
                }
                release_preview()
                update_data({ file: null, probe: null })
                if (caught instanceof ClipError) {
                    error = caught.message
                } else if (caught instanceof Error) {
                    error = `Failed to read media: ${caught.message}`
                } else {
                    error = "Failed to read media"
                }
            } finally {
                if (mine === token.n) {
                    probing = false
                }
            }
        },
        on_reject: (message) => {
            token.n += 1
            update_data({ file: null, probe: null })
            error = message
            probing = false
        },
    })
}

function handle_remove(): void {
    if (compose_state.run_status === "running") {
        return
    }
    token.n += 1
    probing = false
    error = null
    release_preview()
    update_data({ file: null, probe: null })
}

onDestroy(() => {
    token.n += 1
    release_preview()
})
</script>

<div
    class="w-64 overflow-hidden rounded-lg border border-gray-300 bg-white p-3"
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
    <div
        aria-live="polite"
        class="mt-1 min-w-0"
    >
        <p
            class="block w-full min-w-0 max-w-full truncate text-xs text-gray-600"
            title={file_name}
        >
            {file_name}
        </p>
        {#if meta_line}
            <p
                class="block w-full min-w-0 max-w-full truncate text-xs text-gray-500"
                title={meta_line}
            >
                {meta_line}
            </p>
        {/if}
    </div>
    <p
        id={id ? `${id}-status` : undefined}
        aria-live="polite"
        class={error && !probing ? "mt-1 text-xs text-red-700" : "mt-1 text-xs text-gray-500"}
    >
        {probing ? "Reading media…" : (error ?? "")}
    </p>
    <ComposeFileDrop
        accept="video/*,audio/*"
        input_id={id ? `${id}-file` : undefined}
        describedby={id ? `${id}-status` : undefined}
        {choose_label}
        {choose_aria}
        file_name={data.file ? data.file.name : null}
        show_remove={data.file !== null}
        remove_aria={data.file ? `Remove source file ${data.file.name}` : "Remove source file"}
        disabled={probing || running}
        on_file={handle_file}
        on_remove={handle_remove}
    />
</div>
