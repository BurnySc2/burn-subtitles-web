<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import type { MergeNodeData } from "$lib/media/compose-types"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: MergeNodeData
    update_data: (patch: Partial<MergeNodeData>) => void
} = $props()

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
    <p class="text-sm font-medium">Merge</p>
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
