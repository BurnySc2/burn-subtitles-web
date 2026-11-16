<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import ComposeFileDrop from "$lib/components/feature/compose/ComposeFileDrop.svelte"
import { is_accepted } from "$lib/media/compose-drop"
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
let error = $state<string | null>(null)

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

let choose_label = $derived(data.file ? "Replace file" : "Choose file")
let choose_aria = $derived(data.file ? "Replace subtitles file" : "Choose subtitles file")
let file_name = $derived(data.file ? data.file.name : null)
let show_remove = $derived(data.file !== null)
let remove_aria = $derived(data.file ? `Remove subtitles file ${data.file.name}` : "Remove subtitles file")

function handle_file(file: File | null): void {
    if (!file) {
        return
    }
    if (!is_accepted(file, "subtitles")) {
        update_data({ file: null })
        error = "Please select an .srt file."
        return
    }
    error = null
    update_data({ file })
}

function handle_remove(): void {
    error = null
    update_data({ file: null })
}
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
    <p
        id={id ? `${id}-status` : undefined}
        aria-live="polite"
        class="mt-1 text-xs text-red-700"
    >
        {error ?? ""}
    </p>
    <ComposeFileDrop
        accept=".srt"
        input_id={id ? `${id}-file` : undefined}
        describedby={id ? `${id}-status` : undefined}
        {choose_label}
        {choose_aria}
        {file_name}
        {show_remove}
        {remove_aria}
        disabled={false}
        on_file={handle_file}
        on_remove={handle_remove}
    />
</div>
