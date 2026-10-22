<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { type ColorNodeData, compose_node_title } from "$lib/media/compose-types"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: ColorNodeData
    update_data: (patch: Partial<ColorNodeData>) => void
} = $props()

let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("color", data.label))

function on_duration_input(raw: string): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
        update_data({ duration: parsed })
    }
}
</script>

<div
    class="min-w-48 rounded-lg border border-gray-300 bg-white p-3"
    data-testid="compose-node"
    data-kind="color"
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
    <div class="mt-2 flex items-center gap-2">
        <span
            class="inline-block h-6 w-6 rounded border border-gray-300"
            style:background-color={data.color}
            title={data.color}
        ></span>
        <p class="text-xs text-gray-600">{data.duration}s</p>
    </div>
    <div class="mt-2 flex flex-col gap-2">
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Color
            <input
                id={id ? `${id}-color` : undefined}
                type="color"
                value={data.color}
                oninput={(e) => update_data({ color: e.currentTarget.value })}
                class="nodrag h-8 w-full cursor-pointer rounded border border-gray-300"
            >
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Duration (s)
            <input
                id={id ? `${id}-duration` : undefined}
                type="number"
                min="0"
                step="0.001"
                value={data.duration}
                oninput={(e) => on_duration_input(e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
    </div>
</div>
