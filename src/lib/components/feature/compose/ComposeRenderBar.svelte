<script lang="ts">
import { compose_state } from "$lib/media/compose-state.svelte"

let {
    on_render,
    on_cancel,
}: {
    on_render: () => void
    on_cancel: () => void
} = $props()

let running = $derived(compose_state.run_status === "running")
let can_render = $derived(!running && compose_state.nodes.length > 0)
let pct = $derived(Math.round(compose_state.run_progress * 100))
let total = $derived(compose_state.nodes.length)
let done = $derived(Math.min(total, Math.floor(compose_state.run_progress * total)))
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <div class="flex w-full flex-row items-center gap-2">
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
                Rendering… {pct}% ({done}/{total}
                nodes)
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
    {#if compose_state.run_error}
        <p class="rounded bg-red-100 p-2 text-sm text-red-800">{compose_state.run_error}</p>
    {/if}
</div>
