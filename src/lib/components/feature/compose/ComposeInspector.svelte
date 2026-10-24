<script lang="ts">
import { compose_state, remove_compose_nodes } from "$lib/media/compose-state.svelte"
import type {
    ColorNodeData,
    ComposeNode,
    MergeNodeData,
    OutputNodeData,
    OverlayNodeData,
    RescaleNodeData,
    SubtitlesNodeData,
    TransitionNodeData,
    TrimNodeData,
} from "$lib/media/compose-types"
import { compose_node_durations, validate_compose } from "$lib/media/compose-validation"
import {
    QUALITY_QUANTIZER,
    TRANSITION_AUDIO_MODE_DEFAULT,
    TRANSITION_AUDIO_MODE_HINTS,
} from "$lib/media/transition-utils"
import ComposeNodePreview from "./ComposeNodePreview.svelte"
import ComposeOverlayPicker from "./ComposeOverlayPicker.svelte"
import ComposeSourcePicker from "./ComposeSourcePicker.svelte"

let {
    on_preview,
}: {
    on_preview?: (preview: {
        node_id: string | null
        node_type: string | null
        url: string | null
        blob: Blob | null
    }) => void
} = $props()

let selected: ComposeNode | null = $derived(
    compose_state.nodes.find((node) => node.id === compose_state.selected_id) ?? null,
)
let selected_edge_id: string | null = $derived(
    compose_state.selected_edge_id !== null &&
        compose_state.edges.some((edge) => edge.id === compose_state.selected_edge_id)
        ? compose_state.selected_edge_id
        : null,
)
let issues = $derived(validate_compose(compose_state.nodes, compose_state.edges))
let durations = $derived(compose_node_durations(compose_state.nodes, compose_state.edges))
let selected_duration: number | null = $derived(selected ? (durations.get(selected.id) ?? null) : null)
let selected_issues = $derived(selected ? issues.filter((issue) => issue.node_id === selected.id) : [])

function handle_preview(preview: { url: string | null; blob: Blob | null }): void {
    on_preview?.({ node_id: selected?.id ?? null, node_type: selected?.type ?? null, ...preview })
}

function patch_trim(patch: Partial<TrimNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node && node.type === "trim") {
        Object.assign(node.data, patch)
    }
}

function patch_transition(patch: Partial<TransitionNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node && node.type === "transition") {
        Object.assign(node.data, patch)
    }
}

function patch_merge(patch: Partial<MergeNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node && node.type === "merge") {
        Object.assign(node.data, patch)
    }
}

function merge_handle_index(handle: string | null): number {
    if (typeof handle !== "string") {
        return Number.MAX_SAFE_INTEGER
    }
    const match = /^in(\d+)$/.exec(handle)
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

let merge_edges = $derived.by(() => {
    if (!selected || selected.type !== "merge") {
        return []
    }
    return compose_state.edges
        .filter((edge) => edge.target === selected.id)
        .slice()
        .sort((a, b) => merge_handle_index(a.targetHandle) - merge_handle_index(b.targetHandle))
})

function move_merge_edge(index: number, direction: -1 | 1): void {
    if (!selected || selected.type !== "merge") {
        return
    }
    const ordered = merge_edges
    const other = index + direction
    if (index < 0 || other < 0 || index >= ordered.length || other >= ordered.length) {
        return
    }
    const current = ordered[index]
    const sibling = ordered[other]
    const handle_a = current.targetHandle
    current.targetHandle = sibling.targetHandle
    sibling.targetHandle = handle_a
}

function on_merge_count_input(raw: string): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isInteger(parsed)) {
        patch_merge({ input_count: Math.min(8, Math.max(2, parsed)) })
    }
}

function patch_subtitles(patch: Partial<SubtitlesNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node && node.type === "subtitles") {
        Object.assign(node.data, patch)
    }
}

function patch_output(patch: Partial<OutputNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node && node.type === "output") {
        Object.assign(node.data, patch)
    }
}

function patch_overlay(patch: Partial<OverlayNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node && node.type === "overlay") {
        Object.assign(node.data, patch)
    }
}

function patch_color(patch: Partial<ColorNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node && node.type === "color") {
        Object.assign(node.data, patch)
    }
}

function patch_rescale(patch: Partial<RescaleNodeData>): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node && node.type === "rescale") {
        Object.assign(node.data, patch)
    }
}

function patch_label(label: string): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === compose_state.selected_id)
    if (node) {
        node.data.label = label === "" ? null : label
    }
}

function patch_output_name(file_name: string): void {
    patch_output({ file_name: file_name.trim() === "" ? null : file_name.trim() })
}

function on_number_input(raw: string, apply: (value: number) => void): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
        apply(parsed)
    }
}

function on_crf_input(raw: string): void {
    if (raw.trim() === "") {
        patch_output({ crf: null })
        return
    }
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) {
        patch_output({ crf: parsed })
    }
}

function on_show_end_input(raw: string): void {
    if (raw.trim() === "") {
        patch_overlay({ show_end: null })
        return
    }
    on_number_input(raw, (value) => patch_overlay({ show_end: value }))
}

function on_rescale_fps_input(raw: string): void {
    if (raw.trim() === "") {
        patch_rescale({ fps: null })
        return
    }
    on_number_input(raw, (value) => patch_rescale({ fps: value }))
}

function delete_selected_edge(): void {
    if (selected_edge_id === null) {
        return
    }
    const edge_id = selected_edge_id
    compose_state.edges = compose_state.edges.filter((edge) => edge.id !== edge_id)
    compose_state.selected_edge_id = null
}

function delete_selected_node(): void {
    if (selected !== null) {
        remove_compose_nodes([selected.id])
    }
}

function delete_selected(): void {
    if (selected_edge_id !== null) {
        delete_selected_edge()
        return
    }
    delete_selected_node()
}

function on_inspector_keydown(event: KeyboardEvent): void {
    if (event.key !== "Backspace" && event.key !== "Delete") {
        return
    }
    const target = event.target
    if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]")) {
        return
    }
    delete_selected()
}

function probe_summary(node: ComposeNode): string {
    if (node.type !== "source") {
        return ""
    }
    const probe = node.data.probe
    if (!probe) {
        return node.data.file ? node.data.file.name : "No file selected"
    }
    const parts: string[] = [node.data.file?.name ?? probe.file_name]
    if (probe.duration !== null) {
        parts.push(`${probe.duration.toFixed(2)}s`)
    }
    if (probe.display_width !== null && probe.display_height !== null) {
        parts.push(`${probe.display_width}x${probe.display_height}`)
    }
    return parts.join(" · ")
}
</script>

<svelte:window onkeydown={on_inspector_keydown} />
<div class="flex h-full w-full flex-col gap-2 overflow-y-auto rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">Inspector</h2>
    {#if selected_edge_id}
        <p class="text-sm text-gray-600">
            <span class="font-medium">Edge</span>
            <span class="font-mono text-xs"> · {selected_edge_id}</span>
        </p>
        <button
            type="button"
            onclick={delete_selected_edge}
            class="btn btn-sm self-start bg-red-600 text-white transition-colors hover:bg-red-700"
        >
            Delete edge
        </button>
        <p class="text-xs text-gray-500">Tip: click canvas before pressing Del, or use the button.</p>
    {/if}
    {#if !selected}
        {#if !selected_edge_id}
            <p class="text-sm text-gray-500">No node selected — click a node on the canvas.</p>
        {/if}
        <ComposeNodePreview
            node_id={null}
            hide_output
            on_preview={handle_preview}
        />
    {:else}
        <p class="text-sm text-gray-600">
            <span class="font-medium capitalize">{selected.type}</span>
            <span class="font-mono text-xs"> · {selected.id}</span>
        </p>
        <button
            type="button"
            onclick={delete_selected_node}
            class="btn btn-sm self-start bg-red-600 text-white transition-colors hover:bg-red-700"
        >
            Delete node
        </button>
        <label class="flex flex-col gap-1 text-sm font-medium">
            Name (optional)
            <input
                type="text"
                value={selected.data.label ?? ""}
                oninput={(e) => patch_label(e.currentTarget.value)}
                placeholder={selected.type.charAt(0).toUpperCase() + selected.type.slice(1)}
                class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
            >
        </label>
        {#if selected.type === "source"}
            <p class="text-sm text-gray-700">{probe_summary(selected)}</p>
            <ComposeSourcePicker node_id={selected.id} />
        {:else if selected.type === "trim"}
            <label class="flex flex-col gap-1 text-sm font-medium">
                Start (s)
                <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={selected.data.start}
                    oninput={(e) => on_number_input(e.currentTarget.value, (value) => patch_trim({ start: value }))}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
                End (s)
                <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={selected.data.end}
                    oninput={(e) => on_number_input(e.currentTarget.value, (value) => patch_trim({ end: value }))}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
            </label>
        {:else if selected.type === "transition"}
            <label class="flex flex-col gap-1 text-sm font-medium">
                Start (s)
                <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={selected.data.start}
                    oninput={(e) =>
                        on_number_input(e.currentTarget.value, (value) => patch_transition({ start: value }))}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
                Duration (s)
                <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={selected.data.duration}
                    oninput={(e) =>
                        on_number_input(e.currentTarget.value, (value) => patch_transition({ duration: value }))}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
            </label>
            <p class="text-sm text-gray-600">Result duration: {selected_duration?.toFixed(2) ?? "—"}s</p>
            <label class="flex flex-col gap-1 text-sm font-medium">
                Easing
                <select
                    value={selected.data.easing}
                    onchange={(e) =>
                        patch_transition({ easing: e.currentTarget.value as TransitionNodeData["easing"] })}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
                    <option value="linear">linear</option>
                    <option value="exponential">exponential</option>
                </select>
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
                Audio
                <select
                    value={selected.data.audio_mode ?? TRANSITION_AUDIO_MODE_DEFAULT}
                    onchange={(e) =>
                        patch_transition({ audio_mode: e.currentTarget.value as TransitionNodeData["audio_mode"] })}
                    title={TRANSITION_AUDIO_MODE_HINTS[selected.data.audio_mode ?? TRANSITION_AUDIO_MODE_DEFAULT]}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
                    <option
                        value="crossfade"
                        title={TRANSITION_AUDIO_MODE_HINTS.crossfade}
                    >
                        crossfade
                    </option>
                    <option
                        value="a-flat"
                        title={TRANSITION_AUDIO_MODE_HINTS["a-flat"]}
                    >
                        a-flat
                    </option>
                    <option
                        value="a-fadeout"
                        title={TRANSITION_AUDIO_MODE_HINTS["a-fadeout"]}
                    >
                        a-fadeout
                    </option>
                    <option
                        value="b-flat"
                        title={TRANSITION_AUDIO_MODE_HINTS["b-flat"]}
                    >
                        b-flat
                    </option>
                    <option
                        value="b-fadein"
                        title={TRANSITION_AUDIO_MODE_HINTS["b-fadein"]}
                    >
                        b-fadein
                    </option>
                    <option
                        value="mute"
                        title={TRANSITION_AUDIO_MODE_HINTS.mute}
                    >
                        mute
                    </option>
                    <option
                        value="dip"
                        title={TRANSITION_AUDIO_MODE_HINTS.dip}
                    >
                        dip
                    </option>
                    <option
                        value="a-only"
                        title={TRANSITION_AUDIO_MODE_HINTS["a-only"]}
                    >
                        a-only
                    </option>
                    <option
                        value="b-only"
                        title={TRANSITION_AUDIO_MODE_HINTS["b-only"]}
                    >
                        b-only
                    </option>
                </select>
                <small class="text-xs font-normal text-gray-500">
                    {TRANSITION_AUDIO_MODE_HINTS[selected.data.audio_mode ?? TRANSITION_AUDIO_MODE_DEFAULT]}
                </small>
            </label>
        {:else if selected.type === "merge"}
            <label class="flex flex-col gap-1 text-sm font-medium">
                Inputs (2-8)
                <span class="flex items-center gap-2">
                    <button
                        type="button"
                        onclick={() => patch_merge({ input_count: Math.max(2, selected.data.input_count - 1) })}
                        disabled={selected.data.input_count <= 2}
                        class="btn btn-secondary btn-sm"
                        aria-label="Decrease merge inputs"
                    >
                        -
                    </button>
                    <input
                        type="number"
                        min="2"
                        max="8"
                        step="1"
                        value={selected.data.input_count}
                        oninput={(e) => on_merge_count_input(e.currentTarget.value)}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                    <button
                        type="button"
                        onclick={() => patch_merge({ input_count: Math.min(8, selected.data.input_count + 1) })}
                        disabled={selected.data.input_count >= 8}
                        class="btn btn-secondary btn-sm"
                        aria-label="Increase merge inputs"
                    >
                        +
                    </button>
                </span>
            </label>
            {#if merge_edges.length > 0}
                <div class="flex flex-col gap-1">
                    <p class="text-sm font-medium">Input order (in0 first)</p>
                    <ol class="flex flex-col gap-1">
                        {#each merge_edges as edge, index (edge.id)}
                            <li
                                class="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-sm"
                            >
                                <span class="font-mono text-xs text-gray-500">{edge.targetHandle ?? "?"}</span>
                                <span class="min-w-0 flex-1 truncate font-mono text-xs">{edge.source}</span>
                                <button
                                    type="button"
                                    onclick={() => move_merge_edge(index, -1)}
                                    disabled={index === 0}
                                    class="btn btn-secondary btn-sm"
                                    aria-label={`Move ${edge.targetHandle} up`}
                                >
                                    Up
                                </button>
                                <button
                                    type="button"
                                    onclick={() => move_merge_edge(index, 1)}
                                    disabled={index === merge_edges.length - 1}
                                    class="btn btn-secondary btn-sm"
                                    aria-label={`Move ${edge.targetHandle} down`}
                                >
                                    Down
                                </button>
                            </li>
                        {/each}
                    </ol>
                </div>
            {:else}
                <p class="text-sm text-gray-500">Connect 2 or more inputs using handles in0, in1, …</p>
            {/if}
        {:else if selected.type === "subtitles"}
            <label class="flex flex-col gap-1 text-sm font-medium">
                SRT content
                <textarea
                    value={selected.data.content ?? ""}
                    oninput={(e) => patch_subtitles({ content: e.currentTarget.value })}
                    placeholder={"1\n00:00:00,000 --> 00:00:02,000\nHello"}
                    rows="6"
                    class="w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs font-normal"
                ></textarea>
            </label>
            {#if selected.data.file}
                <p class="text-xs text-gray-500">File: {selected.data.file.name}</p>
            {/if}
            <label class="flex flex-col gap-1 text-sm font-medium">
                Mode
                <select
                    value={selected.data.mode}
                    onchange={(e) => patch_subtitles({ mode: e.currentTarget.value as SubtitlesNodeData["mode"] })}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
                    <option value="mux">mux</option>
                    <option value="burn">burn</option>
                    <option value="sidecar">sidecar</option>
                </select>
            </label>
        {:else if selected.type === "overlay"}
            {#key selected.id}
                <ComposeOverlayPicker node_id={selected.id} />
            {/key}
            <label class="flex flex-col gap-1 text-sm font-medium">
                Position
                <select
                    value={selected.data.position}
                    onchange={(e) => patch_overlay({ position: e.currentTarget.value as OverlayNodeData["position"] })}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
                    <option value="top-left">top-left</option>
                    <option value="top-center">top-center</option>
                    <option value="top-right">top-right</option>
                    <option value="center-left">center-left</option>
                    <option value="center">center</option>
                    <option value="center-right">center-right</option>
                    <option value="bottom-left">bottom-left</option>
                    <option value="bottom-center">bottom-center</option>
                    <option value="bottom-right">bottom-right</option>
                </select>
            </label>
            <div class="grid grid-cols-2 gap-2">
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Scale [%]
                    <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={selected.data.scale}
                        oninput={(e) =>
                            on_number_input(e.currentTarget.value, (value) => patch_overlay({ scale: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Opacity
                    <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selected.data.opacity}
                        oninput={(e) =>
                            on_number_input(e.currentTarget.value, (value) => patch_overlay({ opacity: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Offset X
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={selected.data.offset_x}
                        oninput={(e) =>
                            on_number_input(e.currentTarget.value, (value) => patch_overlay({ offset_x: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Offset Y
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={selected.data.offset_y}
                        oninput={(e) =>
                            on_number_input(e.currentTarget.value, (value) => patch_overlay({ offset_y: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Show start (s)
                    <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={selected.data.show_start}
                        oninput={(e) =>
                            on_number_input(e.currentTarget.value, (value) => patch_overlay({ show_start: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Show end (s)
                    <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={selected.data.show_end ?? ""}
                        oninput={(e) => on_show_end_input(e.currentTarget.value)}
                        placeholder="end of video"
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
            </div>
        {:else if selected.type === "color"}
            <label class="flex flex-col gap-1 text-sm font-medium">
                Color
                <span class="flex items-center gap-2">
                    <input
                        type="color"
                        value={selected.data.color}
                        oninput={(e) => patch_color({ color: e.currentTarget.value })}
                        class="h-10 w-16 cursor-pointer rounded border border-gray-300 p-1 font-normal"
                    >
                    <input
                        type="text"
                        value={selected.data.color}
                        oninput={(e) => patch_color({ color: e.currentTarget.value })}
                        placeholder="#000000"
                        spellcheck={false}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs font-normal"
                    >
                </span>
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
                Duration (s)
                <input
                    type="number"
                    min="0"
                    max="3600"
                    step="0.001"
                    value={selected.data.duration}
                    oninput={(e) => on_number_input(e.currentTarget.value, (value) => patch_color({ duration: value }))}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
            </label>
            <p class="text-xs text-gray-500">Duration must be above 0, max 3600s.</p>
        {:else if selected.type === "rescale"}
            <div class="grid grid-cols-2 gap-2">
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Width
                    <input
                        type="number"
                        min="2"
                        step="2"
                        value={selected.data.width}
                        oninput={(e) =>
                            on_number_input(e.currentTarget.value, (value) => patch_rescale({ width: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Height
                    <input
                        type="number"
                        min="2"
                        step="2"
                        value={selected.data.height}
                        oninput={(e) =>
                            on_number_input(e.currentTarget.value, (value) => patch_rescale({ height: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
            </div>
            <p class="text-xs text-gray-500">Width and height must be even numbers.</p>
            <label class="flex flex-col gap-1 text-sm font-medium">
                FPS (empty = keep source)
                <input
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    value={selected.data.fps ?? ""}
                    oninput={(e) => on_rescale_fps_input(e.currentTarget.value)}
                    placeholder="source"
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
            </label>
            <p class="text-xs text-gray-500">FPS must be 1-120 when set.</p>
            <label class="flex flex-col gap-1 text-sm font-medium">
                Fit
                <select
                    value={selected.data.fit}
                    disabled
                    class="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 font-normal text-gray-500"
                >
                    <option value="contain">contain</option>
                </select>
            </label>
            <p class="text-xs text-gray-500">v1 supports contain only.</p>
        {:else if selected.type === "output"}
            <label class="flex flex-col gap-1 text-sm font-medium">
                File name
                <input
                    type="text"
                    value={selected.data.file_name ?? ""}
                    oninput={(e) => patch_output_name(e.currentTarget.value)}
                    placeholder="composition.mp4"
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
            </label>
            <div class="grid grid-cols-3 gap-2">
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Width
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={selected.data.width}
                        oninput={(e) =>
                            on_number_input(e.currentTarget.value, (value) => patch_output({ width: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Height
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={selected.data.height}
                        oninput={(e) =>
                            on_number_input(e.currentTarget.value, (value) => patch_output({ height: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
                <label class="flex flex-col gap-1 text-sm font-medium">
                    FPS
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={selected.data.fps}
                        oninput={(e) => on_number_input(e.currentTarget.value, (value) => patch_output({ fps: value }))}
                        class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                    >
                </label>
            </div>
            <label class="flex flex-col gap-1 text-sm font-medium">
                Quality
                <select
                    value={selected.data.quality}
                    onchange={(e) => patch_output({ quality: e.currentTarget.value as OutputNodeData["quality"] })}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="very-high">very-high</option>
                    <option value="ultra">ultra</option>
                </select>
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
                Audio quality
                <select
                    value={selected.data.audio_quality ?? "source-max"}
                    onchange={(e) =>
                        patch_output({ audio_quality: e.currentTarget.value as OutputNodeData["audio_quality"] })}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
                    <option value="source-max">source-max</option>
                    <option value="96k">96k</option>
                    <option value="128k">128k</option>
                    <option value="192k">192k</option>
                    <option value="256k">256k</option>
                    <option value="320k">320k</option>
                </select>
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
                CRF override
                <input
                    type="number"
                    min="0"
                    max="51"
                    step="1"
                    value={selected.data.crf ?? ""}
                    oninput={(e) => on_crf_input(e.currentTarget.value)}
                    placeholder={`auto (${QUALITY_QUANTIZER[selected.data.quality] ?? "bitrate"})`}
                    class="w-full rounded border border-gray-300 px-3 py-2 font-normal"
                >
                {#if selected.data.quality === "ultra"}
                    <small class="text-xs font-normal text-gray-500">
                        Ultra default: 50 Mbps bitrate-only; optional CRF adds quantizer.
                    </small>
                {/if}
            </label>
            <p class="text-sm text-gray-600">Result duration: {selected_duration?.toFixed(2) ?? "—"}s</p>
        {/if}
        {#key selected.id}
            <ComposeNodePreview
                node_id={selected.id}
                hide_output
                on_preview={handle_preview}
            />
        {/key}
        {#if selected_issues.length > 0}
            <ul class="flex flex-col gap-1">
                {#each selected_issues as issue (issue.field ?? issue.message)}
                    <li class="rounded bg-red-100 p-2 text-sm text-red-800">
                        {#if issue.field}
                            {issue.field}:
                        {/if}
                        {issue.message}
                    </li>
                {/each}
            </ul>
        {:else}
            <p class="text-sm font-medium text-green-700">✓ Node valid</p>
        {/if}
    {/if}
</div>
