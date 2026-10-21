<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type {
    ComposeNode,
    OutputNodeData,
    SubtitlesNodeData,
    TransitionNodeData,
    TrimNodeData,
} from "$lib/media/compose-types"
import { validate_compose } from "$lib/media/compose-validation"
import ComposeSourcePicker from "./ComposeSourcePicker.svelte"

let selected: ComposeNode | null = $derived(
    compose_state.nodes.find((node) => node.id === compose_state.selected_id) ?? null,
)
let issues = $derived(validate_compose(compose_state.nodes, compose_state.edges))
let selected_issues = $derived(selected ? issues.filter((issue) => issue.node_id === selected.id) : [])

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

function patch_output_name(file_name: string): void {
    patch_output({ file_name: file_name === "" ? null : file_name })
}

function on_number_input(raw: string, apply: (value: number) => void): void {
    const parsed = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(parsed)) {
        apply(parsed)
    }
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

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">Inspector</h2>
    {#if !selected}
        <p class="text-sm text-gray-500">No node selected — click a node on the canvas.</p>
    {:else}
        <p class="text-sm text-gray-600">
            <span class="font-medium capitalize">{selected.type}</span>
            <span class="font-mono text-xs"> · {selected.id}</span>
        </p>
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
        {/if}
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
    {#if issues.length > 0}
        <details class="rounded border border-gray-300 bg-white p-2">
            <summary class="cursor-pointer text-sm font-medium">Graph issues ({issues.length})</summary>
            <ul class="mt-2 flex flex-col gap-1">
                {#each issues as issue, index (`${issue.node_id ?? "graph"}-${issue.field ?? "general"}-${index}`)}
                    <li class="text-xs text-red-800">
                        {#if issue.node_id}
                            <span class="font-mono">{issue.node_id}</span>
                            ·
                        {/if}
                        {issue.message}
                    </li>
                {/each}
            </ul>
        </details>
    {/if}
</div>
