<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { ComposeNodeKind } from "$lib/media/compose-types"

let { on_add }: { on_add: (kind: ComposeNodeKind) => void } = $props()

let running = $derived(compose_state.run_status === "running")

const palette: { kind: ComposeNodeKind; label: string }[] = [
    { kind: "source", label: "Source" },
    { kind: "trim", label: "Trim" },
    { kind: "transition", label: "Transition" },
    { kind: "subtitles", label: "Subtitles" },
    { kind: "output", label: "Output" },
]
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <div class="flex flex-wrap items-center gap-2">
        {#each palette as entry (entry.kind)}
            <button
                type="button"
                onclick={() => on_add(entry.kind)}
                disabled={running}
                class="btn btn-secondary btn-sm"
            >
                + {entry.label}
            </button>
        {/each}
    </div>
</div>
