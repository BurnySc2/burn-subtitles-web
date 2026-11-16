<script lang="ts">
import { first_dropped_file } from "$lib/media/compose-drop"

let {
    on_file,
    on_remove,
    disabled = false,
}: {
    on_file: (file: File) => void
    on_remove?: () => void
    disabled?: boolean
} = $props()

let file_name: string | null = $state(null)
let error_message: string | null = $state(null)
let is_dragging = $state(false)
let file_input: HTMLInputElement | null = $state(null)

let choose_label = $derived(file_name ? "Replace file" : "Choose file")
let show_remove = $derived(file_name !== null)

function is_viewer_accepted(file: File): boolean {
    return file.type === "" || file.type.startsWith("video/") || file.type.startsWith("audio/")
}

function accept_file(file: File | null) {
    if (!file) {
        return
    }
    if (!is_viewer_accepted(file)) {
        error_message = `Rejected: ${file.name} — select video or audio`
        return
    }
    error_message = null
    file_name = file.name
    on_file(file)
}

function handle_pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0] ?? null
    input.value = ""
    accept_file(file)
}

function handle_remove() {
    file_name = null
    error_message = null
    on_remove?.()
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions: inner button/input is the keyboard path; drop is enhancement only, so no role=button -->
<div
    class="drop-zone w-full"
    class:drag-over={is_dragging}
    ondragover={(event) => {
        if (disabled) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        is_dragging = true
    }}
    ondragleave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return
        }
        is_dragging = false
    }}
    ondrop={(event) => {
        event.preventDefault()
        if (disabled) {
            return
        }
        event.stopPropagation()
        try {
            accept_file(first_dropped_file(event))
        } finally {
            is_dragging = false
        }
    }}
>
    <input
        bind:this={file_input}
        type="file"
        accept="video/*,audio/*"
        onchange={handle_pick}
        aria-describedby="viewer-file-status"
        {disabled}
        class="hidden"
    >
    <div class="mt-2 flex justify-center gap-2">
        <button
            type="button"
            onclick={() => file_input?.click()}
            {disabled}
            class="btn btn-secondary btn-sm"
        >
            {choose_label}
        </button>
        {#if show_remove}
            <button
                type="button"
                onclick={handle_remove}
                {disabled}
                class="btn btn-sm bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
            >
                Remove
            </button>
        {/if}
    </div>
    {#if error_message}
        <p
            id="viewer-file-status"
            aria-live="polite"
            class="mt-2 text-sm font-medium text-red-700"
        >
            {error_message}
        </p>
    {:else if file_name}
        <p
            id="viewer-file-status"
            aria-live="polite"
            class="mt-2 text-sm font-medium text-green-700"
        >
            ✓ Accepted: {file_name}
        </p>
    {:else}
        <p
            id="viewer-file-status"
            aria-live="polite"
            class="mt-2 text-sm text-gray-500"
        >
            No file chosen — select video or audio
        </p>
    {/if}
</div>
