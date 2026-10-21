<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { ComposeNodeKind } from "$lib/media/compose-types"

let { on_add }: { on_add: (kind: ComposeNodeKind) => void } = $props()

let running = $derived(compose_state.run_status === "running")
let selected: string = $state("source")

// WHY disabled-future: new kinds need ComposeNodeKind + canvas nodeTypes + handle_add branch — see compose-types.ts
function is_addable(value: string): value is ComposeNodeKind {
    return (
        value === "source" || value === "trim" || value === "transition" || value === "subtitles" || value === "output"
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
        bind:value={selected}
        disabled={running}
    >
        <optgroup label="Video">
            <option value="source">Source</option>
            <option value="trim">Trim</option>
            <option value="transition">Transition</option>
            <option
                value="resize"
                disabled
            >
                Resize (future)
            </option>
            <option
                value="canvas"
                disabled
            >
                Canvas (future)
            </option>
            <option
                value="overlay"
                disabled
            >
                Overlay (future)
            </option>
            <option
                value="logo"
                disabled
            >
                Logo (future)
            </option>
            <option
                value="fade"
                disabled
            >
                Fade (future)
            </option>
            <option value="subtitles">Subtitles</option>
            <option
                value="merge"
                disabled
            >
                Merge (future)
            </option>
        </optgroup>
        <optgroup label="Audio">
            <option
                value="audio-note"
                disabled
            >
                Audio settings in Output for now
            </option>
        </optgroup>
        <optgroup label="IO">
            <option value="output">Output</option>
            <option
                value="encode"
                disabled
            >
                Encode (future)
            </option>
        </optgroup>
    </select>
    <button
        type="button"
        onclick={handle_click}
        disabled={running}
        class="btn btn-primary btn-sm"
    >
        Add
    </button>
</div>
