<script lang="ts">
import { tick } from "svelte"
import { font_registry, font_registry_version } from "../../../media/compose-font-library"
import ComposeFontLibrary from "./ComposeFontLibrary.svelte"

let open = $state(false)
let trigger_ref: HTMLButtonElement | null = $state(null)
let panel_ref: HTMLDivElement | null = $state(null)

let font_count = $derived.by(() => {
    $font_registry_version
    return font_registry.entries.length
})

function open_dialog(): void {
    open = true
}

function close_dialog(): void {
    open = false
    trigger_ref?.focus()
}

$effect(() => {
    if (open) {
        void tick().then(() => panel_ref?.focus())
    }
})
</script>

<svelte:window
    onkeydown={(event) => {
        if (open && event.key === "Escape") {
            close_dialog()
        }
    }}
/>

<button
    type="button"
    bind:this={trigger_ref}
    onclick={open_dialog}
    class="btn btn-secondary btn-sm"
>
    Font library ({font_count})
</button>

{#if open}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
            type="button"
            aria-label="Close font library"
            onclick={close_dialog}
            class="absolute inset-0 cursor-default bg-black/50"
        ></button>
        <div
            bind:this={panel_ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-font-dialog-title"
            tabindex="-1"
            class="relative z-10 max-w-lg w-full rounded-lg bg-white p-4"
        >
            <h2
                id="compose-font-dialog-title"
                class="text-lg font-semibold"
            >
                Font library
            </h2>
            <p class="text-sm text-gray-600">Upload once, use in any text node. Custom fonts are listed here.</p>
            <ComposeFontLibrary />
            <button
                type="button"
                onclick={close_dialog}
                aria-label="Close font library"
                class="btn btn-secondary btn-sm mt-4"
            >
                Close font library
            </button>
        </div>
    </div>
{/if}
