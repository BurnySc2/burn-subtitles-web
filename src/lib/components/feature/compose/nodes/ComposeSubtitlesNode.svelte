<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_node_title, SUBTITLE_BURN_DEFAULTS, type SubtitlesNodeData } from "$lib/media/compose-types"

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

let family = $derived(
    typeof data.font_family === "string" && data.font_family.trim() !== ""
        ? data.font_family.trim()
        : SUBTITLE_BURN_DEFAULTS.font_family,
)
let is_default_family = $derived(family === SUBTITLE_BURN_DEFAULTS.font_family)
let badge = $derived.by(() => {
    const source = data.file ? data.file.name : "no file"
    return is_default_family ? source : `${source} · ${family}`
})
</script>

<div
    class="min-w-48 rounded-lg border border-gray-300 bg-white p-3"
    data-testid="compose-node"
    data-kind="subtitles"
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
        id={id ? `${id}-badge` : undefined}
        class="mt-1 text-xs text-gray-500"
        title={is_default_family ? undefined : `Font: ${family}`}
    >
        {badge}
    </p>
</div>
