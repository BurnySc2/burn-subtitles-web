<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import type { SubtitlesNodeData } from "$lib/media/compose-types"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: SubtitlesNodeData
    update_data: (patch: Partial<SubtitlesNodeData>) => void
} = $props()
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
    <p class="text-sm font-medium">Subtitles</p>
    <label class="mt-2 flex flex-col gap-1 text-xs text-gray-600">
        SRT content
        <textarea
            id={id ? `${id}-content` : undefined}
            value={data.content ?? ""}
            oninput={(e) => update_data({ content: e.currentTarget.value })}
            placeholder="1&#10;00:00:00,000 --> 00:00:02,000&#10;Hello"
            rows="4"
            class="nodrag w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs text-gray-900"
        ></textarea>
    </label>
    <label class="mt-2 flex flex-col gap-1 text-xs text-gray-600">
        Mode
        <select
            id={id ? `${id}-mode` : undefined}
            value={data.mode}
            onchange={(e) => update_data({ mode: e.currentTarget.value as SubtitlesNodeData["mode"] })}
            class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
        >
            <option value="mux">mux</option>
            <option value="burn">burn</option>
            <option value="sidecar">sidecar</option>
        </select>
    </label>
</div>
