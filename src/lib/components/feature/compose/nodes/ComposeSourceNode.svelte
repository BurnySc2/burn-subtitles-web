<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { set_source_file, set_source_probe } from "$lib/media/compose-state.svelte"
import type { SourceNodeData } from "$lib/media/compose-types"
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
let token = 0

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

<div class="min-w-48 rounded-lg border border-gray-300 bg-white p-3">
    <Handle
        type="source"
        position={Position.Right}
    />
    <p class="text-sm font-medium">Source</p>
    <p class="mt-1 text-xs text-gray-600">{probe_line}</p>
    {#if probing}
        <p class="mt-1 text-xs text-gray-500">Reading media…</p>
    {:else if error}
        <p class="mt-1 text-xs text-red-700">{error}</p>
    {/if}
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
        class="btn btn-primary btn-sm nodrag mt-2"
    >
        Choose file
    </button>
</div>
