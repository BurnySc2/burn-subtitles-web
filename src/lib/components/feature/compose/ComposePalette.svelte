<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { ComposeNodeKind } from "$lib/media/compose-types"

let { on_add }: { on_add: (kind: ComposeNodeKind) => void } = $props()

let running = $derived(compose_state.run_status === "running")
let selected: string = $state("source")

function is_addable(value: string): value is ComposeNodeKind {
    return (
        value === "source" ||
        value === "trim" ||
        value === "transition" ||
        value === "merge" ||
        value === "subtitles" ||
        value === "overlay" ||
        value === "text" ||
        value === "color" ||
        value === "rescale" ||
        value === "output"
    )
}

function handle_click(): void {
    if (is_addable(selected)) {
        on_add(selected)
    }
}
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <label
        class="form-label"
        for="compose-palette"
        >Add node</label
    >
    <select
        id="compose-palette"
        data-testid="compose-palette-select"
        bind:value={selected}
        disabled={running}
    >
        <optgroup label="Video">
            <option value="source">Source</option>
            <option value="trim">Trim</option>
            <option value="transition">Transition</option>
            <option value="merge">Merge</option>
            <option value="color">Color</option>
            <option value="rescale">Rescale</option>
            <option value="overlay">Overlay</option>
            <option value="text">Text</option>
            <option value="subtitles">Subtitles</option>
        </optgroup>
        <optgroup label="IO">
            <option value="output">Output</option>
        </optgroup>
    </select>
    <button
        type="button"
        data-testid="compose-palette-add"
        onclick={handle_click}
        disabled={running}
        class="btn btn-primary btn-sm"
    >
        Add
    </button>
</div>
