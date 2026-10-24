<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { compose_node_title, type OutputNodeData } from "$lib/media/compose-types"
import { QUALITY_QUANTIZER } from "$lib/media/transition-utils"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: OutputNodeData
    update_data: (patch: Partial<OutputNodeData>) => void
} = $props()

let editing_label = $state(false)
let label_draft = $state("")

let title = $derived(compose_node_title("output", data.label))

function on_number_input(field: "width" | "height" | "fps", raw: string): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
        update_data({ [field]: parsed })
    }
}

function on_crf_input(raw: string): void {
    if (raw.trim() === "") {
        update_data({ crf: null })
        return
    }
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) {
        update_data({ crf: parsed })
    }
}
</script>

<div
    class="min-w-64 rounded-lg border border-gray-300 bg-white p-4"
    data-testid="compose-node"
    data-kind="output"
>
    <Handle
        type="target"
        position={Position.Left}
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
    <div class="mt-2 grid grid-cols-2 gap-2">
        <label class="col-span-2 flex flex-col gap-1 text-xs text-gray-600">
            File name
            <input
                id={id ? `${id}-file-name` : undefined}
                type="text"
                value={data.file_name ?? ""}
                oninput={(e) => {
                    const value = e.currentTarget.value
                    update_data({ file_name: value.trim() === "" ? null : value.trim() })
                }}
                placeholder="composition.mp4"
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Width
            <input
                id={id ? `${id}-width` : undefined}
                type="number"
                min="1"
                step="1"
                value={data.width}
                oninput={(e) => on_number_input("width", e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Height
            <input
                id={id ? `${id}-height` : undefined}
                type="number"
                min="1"
                step="1"
                value={data.height}
                oninput={(e) => on_number_input("height", e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            FPS
            <input
                id={id ? `${id}-fps` : undefined}
                type="number"
                min="1"
                step="1"
                value={data.fps}
                oninput={(e) => on_number_input("fps", e.currentTarget.value)}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Quality
            <select
                id={id ? `${id}-quality` : undefined}
                value={data.quality}
                onchange={(e) => update_data({ quality: e.currentTarget.value as OutputNodeData["quality"] })}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="very-high">very-high</option>
                <option value="ultra">ultra</option>
            </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            Audio quality
            <select
                id={id ? `${id}-audio-quality` : undefined}
                value={data.audio_quality ?? "source-max"}
                onchange={(e) =>
                    update_data({ audio_quality: e.currentTarget.value as OutputNodeData["audio_quality"] })}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
                <option value="source-max">source-max</option>
                <option value="96k">96k</option>
                <option value="128k">128k</option>
                <option value="192k">192k</option>
                <option value="256k">256k</option>
                <option value="320k">320k</option>
            </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-gray-600">
            CRF override
            <input
                id={id ? `${id}-crf` : undefined}
                type="number"
                min="0"
                max="51"
                step="1"
                value={data.crf ?? ""}
                oninput={(e) => on_crf_input(e.currentTarget.value)}
                placeholder={`auto (${QUALITY_QUANTIZER[data.quality] ?? "bitrate"})`}
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
    </div>
</div>
