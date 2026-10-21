<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_node_title, type RescaleNodeData } from "$lib/media/compose-types"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: RescaleNodeData
    update_data: (patch: Partial<RescaleNodeData>) => void
} = $props()

let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("rescale", data.label))

let size_label = $derived(`${data.width}x${data.height}${data.fps !== null ? `@${data.fps}` : ""}`)

function on_number_input(field: "width" | "height", raw: string): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
        update_data({ [field]: parsed })
    }
}

function on_fps_input(raw: string): void {
    if (raw.trim() === "") {
        update_data({ fps: null })
        return
    }
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) {
        update_data({ fps: parsed })
    }
}
</script>

<div class="min-w-48 rounded-lg border border-gray-300 bg-white p-3">
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
    <p class="mt-1 text-xs text-gray-600">{size_label}</p>
    <div class="mt-2 flex flex-col gap-2">
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Width
            <input
                id={id ? `${id}-width` : undefined}
                type="number"
                min="1"
                step="1"
                value={data.width}
                oninput={(e) => on_number_input("width", e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Height
            <input
                id={id ? `${id}-height` : undefined}
                type="number"
                min="1"
                step="1"
                value={data.height}
                oninput={(e) => on_number_input("height", e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            FPS (empty = keep)
            <input
                id={id ? `${id}-fps` : undefined}
                type="number"
                min="1"
                step="1"
                value={data.fps ?? ""}
                placeholder="Source"
                oninput={(e) => on_fps_input(e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
    </div>
</div>
