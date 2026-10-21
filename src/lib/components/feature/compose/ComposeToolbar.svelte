<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"
import type { ComposeNodeKind } from "$lib/media/compose-types"
import { validate_compose } from "$lib/media/compose-validation"

let {
    on_add,
    on_render,
    on_cancel,
}: {
    on_add: (kind: ComposeNodeKind) => void
    on_render: () => void
    on_cancel: () => void
} = $props()

const palette: { kind: ComposeNodeKind; label: string }[] = [
    { kind: "source", label: "Source" },
    { kind: "trim", label: "Trim" },
    { kind: "transition", label: "Transition" },
    { kind: "subtitles", label: "Subtitles" },
    { kind: "output", label: "Output" },
]

let issues = $derived(validate_compose(compose_state.nodes, compose_state.edges))
let running = $derived(compose_state.run_status === "running")
let can_render = $derived(!running && compose_state.nodes.length > 0)
let validity_class = $derived(
    issues.length > 0 ? "text-center text-sm text-red-700" : "text-center text-sm font-medium text-green-700",
)
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
    <div class="flex flex-row items-center justify-center gap-2">
        <button
            type="button"
            onclick={on_render}
            disabled={!can_render}
            class="btn btn-primary inline-flex flex-1 items-center justify-center gap-2"
        >
            {#if running}
                <div
                    class="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                    aria-hidden="true"
                ></div>
                Rendering… {Math.round(compose_state.run_progress * 100)}%
            {:else}
                Render
            {/if}
        </button>
        {#if running}
            <button
                type="button"
                onclick={on_cancel}
                class="btn bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
            >
                Cancel
            </button>
        {/if}
    </div>
    <p
        aria-live="polite"
        class={validity_class}
    >
        {#if issues.length > 0}
            {issues.length}
            issue{issues.length === 1 ? "" : "s"}
            — see inspector
        {:else}
            ✓ Graph valid
        {/if}
    </p>
    {#if compose_state.run_error}
        <p class="rounded bg-red-100 p-2 text-sm text-red-800">{compose_state.run_error}</p>
    {/if}
</div>
