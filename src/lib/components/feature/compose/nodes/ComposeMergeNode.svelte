<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_node_title, type MergeNodeData } from "$lib/media/compose-types"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: MergeNodeData
    update_data: (patch: Partial<MergeNodeData>) => void
} = $props()

let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("merge", data.label))

function on_count_input(raw: string): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isInteger(parsed)) {
        update_data({ input_count: Math.min(8, Math.max(2, parsed)) })
    }
}

let handles = $derived(Array.from({ length: data.input_count }, (_, index) => `in${index}`))
</script>

<div class="min-w-48 rounded-lg border border-gray-300 bg-white p-3">
    {#each handles as handle, index (handle)}
        <Handle
            id={handle}
            type="target"
            position={Position.Left}
            style={`top: ${((index + 1) / (handles.length + 1)) * 100}%;`}
        />
    {/each}
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
    <p class="mt-1 text-xs text-gray-500">Concat in0 first</p>
    <div class="mt-2 flex flex-col gap-2">
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Inputs (2-8)
            <input
                id={id ? `${id}-input-count` : undefined}
                type="number"
                min="2"
                max="8"
                step="1"
                value={data.input_count}
                oninput={(e) => on_count_input(e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
    </div>
</div>
