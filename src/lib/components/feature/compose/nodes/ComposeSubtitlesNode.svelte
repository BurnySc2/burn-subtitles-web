<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_node_title, type SubtitlesNodeData } from "$lib/media/compose-types"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: SubtitlesNodeData
    update_data: (patch: Partial<SubtitlesNodeData>) => void
} = $props()

let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("subtitles", data.label))
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
