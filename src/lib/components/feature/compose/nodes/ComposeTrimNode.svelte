<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_state } from "$lib/media/compose-state.svelte"
import { parse_trim_field } from "$lib/media/compose-trim"
import { compose_node_title, type TrimNodeData } from "$lib/media/compose-types"
import { compose_node_durations } from "$lib/media/compose-validation"

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

let durations = $derived(compose_node_durations(compose_state.nodes, compose_state.edges))
let result_duration: number | null = $derived(id ? (durations.get(id) ?? null) : null)

function on_trim_input(field: "start" | "end", raw: string): void {
    const parsed = parse_trim_field(raw)
    if (parsed !== undefined) {
        update_data({ [field]: parsed })
    }
}
</script>

<div
    class="min-w-48 rounded-lg border border-gray-300 bg-white p-3"
    data-testid="compose-node"
    data-kind="trim"
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
    <div class="mt-2 flex flex-col gap-2">
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Start (s)
            <input
                id={id ? `${id}-start` : undefined}
                type="number"
                min="0"
                step="0.001"
                value={data.start ?? ""}
                placeholder="0 = from start"
                oninput={(e) => on_trim_input("start", e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <p class="text-xs text-gray-600">Empty start means from start.</p>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            End (s)
            <input
                id={id ? `${id}-end` : undefined}
                type="number"
                min="0"
                step="0.001"
                value={data.end ?? ""}
                placeholder="empty = to end"
                oninput={(e) => on_trim_input("end", e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <p class="text-xs text-gray-600">Empty end means to end; both empty is not allowed.</p>
        <p class="text-xs text-gray-600">Result: {result_duration?.toFixed(2) ?? "—"}s</p>
    </div>
</div>
