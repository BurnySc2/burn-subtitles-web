<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_node_title, type TransitionNodeData } from "$lib/media/compose-types"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: TransitionNodeData
    update_data: (patch: Partial<TransitionNodeData>) => void
} = $props()

let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("transition", data.label))
</script>

<div class="min-w-48 rounded-lg border border-gray-300 bg-white p-3">
    <Handle
        id="a"
        type="target"
        position={Position.Left}
        style="top: 35%;"
    />
    <Handle
        id="b"
        type="target"
        position={Position.Left}
        style="top: 65%;"
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
            Duration (s)
            <input
                id={id ? `${id}-duration` : undefined}
                type="number"
                min="0"
                step="0.1"
                value={data.duration}
                oninput={(e) => {
                    const parsed = Number(e.currentTarget.value)
                    if (e.currentTarget.value.trim() !== "" && Number.isFinite(parsed)) {
                        update_data({ duration: parsed })
                    }
                }}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Easing
            <select
                id={id ? `${id}-easing` : undefined}
                value={data.easing}
                onchange={(e) => update_data({ easing: e.currentTarget.value as TransitionNodeData["easing"] })}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
                <option value="linear">linear</option>
                <option value="exponential">exponential</option>
            </select>
        </label>
    </div>
</div>
