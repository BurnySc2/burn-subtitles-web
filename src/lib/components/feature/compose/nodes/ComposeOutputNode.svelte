<script lang="ts">
import { Handle, Position } from "@xyflow/svelte"
import type { OutputNodeData } from "$lib/media/compose-types"

let {
    id = "",
    data,
    update_data,
}: {
    id?: string
    data: OutputNodeData
    update_data: (patch: Partial<OutputNodeData>) => void
} = $props()

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

<div class="min-w-64 rounded-lg border border-gray-300 bg-white p-4">
    <Handle
        type="target"
        position={Position.Left}
    />
    <p class="text-sm font-medium">Output</p>
    <div class="mt-2 grid grid-cols-2 gap-2">
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
            Audio
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
            CRF
            <input
                id={id ? `${id}-crf` : undefined}
                type="number"
                min="0"
                max="51"
                step="1"
                value={data.crf ?? ""}
                oninput={(e) => on_crf_input(e.currentTarget.value)}
                placeholder="auto"
                class="nodrag w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
        </label>
    </div>
</div>
