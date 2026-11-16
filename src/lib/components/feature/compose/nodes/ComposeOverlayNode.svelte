<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import ComposeFileDrop from "$lib/components/feature/compose/ComposeFileDrop.svelte"
import { is_accepted } from "$lib/media/compose-drop"
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

let probing = $state(false)
let error = $state<string | null>(null)
let image_probe = $state<ImageProbe | null>(null)
let probed_file = $state<File | null>(null)
let token = 0
let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("overlay", data.label))
let has_image = $derived(data.image !== null)
let choose_label = $derived(has_image ? "Replace image" : "Choose image")
let choose_aria = $derived(has_image ? "Replace overlay image" : "Choose overlay image")
let summary = $derived(`${data.position} · ${data.scale}% · ${data.opacity}`)

let file_name = $derived(data.image ? data.image.name : "No image selected")
let meta_line = $derived(image_probe && probed_file === data.image ? `${image_probe.width}x${image_probe.height}` : "")
let show_remove = $derived(data.image !== null)
let remove_aria = $derived(data.image ? `Remove overlay image ${data.image.name}` : "Remove overlay image")

async function handle_file(file: File | null): Promise<void> {
    if (!file || !id) {
        return
    }
    const mine = ++token
    probing = true
    error = null
    image_probe = null
    probed_file = null
    if (!is_accepted(file, "overlay")) {
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

function handle_remove(): void {
    token += 1
    probing = false
    error = null
    image_probe = null
    probed_file = null
    update_data({ image: null })
}
</script>

<div
    class="w-64 overflow-hidden rounded-lg border border-gray-300 bg-white p-3"
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
    {#if probing}
        <p class="mt-1 text-xs text-gray-500">Reading image…</p>
    {:else if error}
        <p class="mt-1 text-xs text-red-700">{error}</p>
    {/if}
    <ComposeFileDrop
        accept="image/*"
        input_id={id ? `${id}-file` : undefined}
        {choose_label}
        {choose_aria}
        file_name={data.image ? data.image.name : null}
        {show_remove}
        {remove_aria}
        disabled={false}
        on_file={handle_file}
        on_remove={handle_remove}
    />
</div>
