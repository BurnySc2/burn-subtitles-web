<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_node_title, type TrimNodeData } from "$lib/media/compose-types"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: TrimNodeData
    update_data: (patch: Partial<TrimNodeData>) => void
} = $props()

let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("trim", data.label))

function on_number_input(field: "start" | "end", raw: string): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
        update_data({ [field]: parsed })
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
    <div class="mt-2 flex flex-col gap-2">
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Start (s)
            <input
                id={id ? `${id}-start` : undefined}
                type="number"
                min="0"
                step="0.001"
                value={data.start}
                oninput={(e) => on_number_input("start", e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            End (s)
            <input
                id={id ? `${id}-end` : undefined}
                type="number"
                min="0"
                step="0.001"
                value={data.end}
                oninput={(e) => on_number_input("end", e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
    </div>
</div>
