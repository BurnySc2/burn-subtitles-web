<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_node_title, type OverlayNodeData } from "$lib/media/compose-types"
import type { ImageProbe } from "$lib/media/mediabunny-overlay"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: OverlayNodeData
    update_data: (patch: Partial<OverlayNodeData>) => void
} = $props()

let file_input = $state<HTMLInputElement | null>(null)
let probing = $state(false)
let error = $state<string | null>(null)
let image_probe = $state<ImageProbe | null>(null)
let probed_file = $state<File | null>(null)
let token = 0
let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("overlay", data.label))
let summary = $derived(`${data.position} · ${data.scale}% · ${data.opacity}`)

let file_line = $derived.by(() => {
    if (!data.image) {
        return "No image selected"
    }
    const parts = [data.image.name]
    if (image_probe && probed_file === data.image) {
        parts.push(`${image_probe.width}x${image_probe.height}`)
    }
    return parts.join(" · ")
})

async function handle_file(file: File | null): Promise<void> {
    if (!file || !id) {
        return
    }
    const mine = ++token
    probing = true
    error = null
    image_probe = null
    probed_file = null
    if (!file.type.startsWith("image/")) {
        update_data({ image: null })
        error = "Please select an image file."
        probing = false
        return
    }
    update_data({ image: file })
    try {
        const { probe_image } = await import("$lib/media/mediabunny-overlay")
        const result = await probe_image(file)
        if (mine !== token) {
            return
        }
        image_probe = result
        probed_file = file
    } catch (caught) {
        if (mine !== token) {
            return
        }
        update_data({ image: null })
        error = caught instanceof Error ? caught.message : "Failed to read image."
    } finally {
        if (mine === token) {
            probing = false
        }
    }
}

$effect(() => {
    if (!data.image) {
        token += 1
        probing = false
        image_probe = null
        probed_file = null
    } else if (data.image !== probed_file && image_probe) {
        image_probe = null
        probed_file = null
    }
})
</script>

<div
    class="min-w-48 rounded-lg border border-gray-300 bg-white p-3"
    data-testid="compose-node"
    data-kind="overlay"
>
    <Handle
        type="target"
        position={Position.Left}
    />
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
        id={id ? `${id}-summary` : undefined}
        class="mt-1 text-xs text-gray-500"
    >
        {summary}
    </p>
    <p class="mt-1 text-xs text-gray-600">{file_line}</p>
    {#if probing}
        <p class="mt-1 text-xs text-gray-500">Reading image…</p>
    {:else if error}
        <p class="mt-1 text-xs text-red-700">{error}</p>
    {/if}
    <input
        id={id ? `${id}-file` : undefined}
        bind:this={file_input}
        type="file"
        accept="image/*"
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
        Choose image
    </button>
</div>
