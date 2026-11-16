<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import { encode_hint_for_graph } from "$lib/media/compose-encode-hint"
import { compose_state } from "$lib/media/compose-state.svelte"
import { compose_node_title, type OutputNodeData } from "$lib/media/compose-types"
import { compose_node_durations } from "$lib/media/compose-validation"
import { format_size_estimate, resolve_audio_bitrate, resolve_compose_video_bps } from "$lib/media/transition-utils"

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

let durations = $derived(compose_node_durations(compose_state.nodes, compose_state.edges))
let result_duration: number | null = $derived(id ? (durations.get(id) ?? null) : null)
let encode_hint = $derived(encode_hint_for_graph(compose_state.nodes, data))
let effective_video_bps = $derived(resolve_compose_video_bps(data.video_bitrate_kbps))
let audio_bps = $derived(resolve_audio_bitrate(null, null, data.audio_quality ?? "source-max"))
let size_estimate = $derived(
    !encode_hint.reencodes ? "—" : format_size_estimate(result_duration, effective_video_bps, audio_bps),
)

function on_number_input(field: "width" | "height" | "fps", raw: string): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
        update_data({ [field]: parsed })
    }
}

function on_bitrate_input(raw: string): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
        update_data({ video_bitrate_kbps: parsed })
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
    <p class="text-xs text-gray-600">Duration: {result_duration?.toFixed(2) ?? "—"}s</p>
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
            Video bitrate (kbit/s)
            <input
                id={id ? `${id}-video-bitrate` : undefined}
                type="number"
                min="500"
                max="100000"
                step="100"
                value={data.video_bitrate_kbps}
                oninput={(e) => on_bitrate_input(e.currentTarget.value)}
                placeholder="e.g. 8000"
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
        <label
            class="flex flex-col gap-1 text-xs text-gray-600"
            title="AAC bitrate"
        >
            Audio quality (AAC)
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
        <p
            class="col-span-2 text-xs text-gray-500"
            data-testid="size-estimate"
        >
            {size_estimate}
        </p>
    </div>
</div>
