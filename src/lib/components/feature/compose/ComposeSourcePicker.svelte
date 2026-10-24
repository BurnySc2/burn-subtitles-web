<script lang="ts">
import { first_dropped_file, is_accepted } from "$lib/media/compose-drop"
import { compose_state, set_source_file, set_source_probe } from "$lib/media/compose-state.svelte"
import { ClipError, probe_media } from "$lib/media/mediabunny-clip"

let { node_id }: { node_id: string } = $props()

let probing = $state(false)
let error = $state<string | null>(null)
let is_dragging = $state(false)
let token = 0

let node = $derived(compose_state.nodes.find((candidate) => candidate.id === node_id) ?? null)
let file_name = $derived(node && node.type === "source" ? (node.data.file?.name ?? null) : null)

let status_class = $derived(
    error ? "text-sm text-red-700" : file_name ? "text-sm font-medium text-green-700" : "text-sm text-gray-500",
)

async function handle_file(file: File | null): Promise<void> {
    if (!file) {
        return
    }
    if (!is_accepted(file, "source")) {
        token += 1
        error = "Please select a video or audio file."
        probing = false
        return
    }
    const mine = ++token
    probing = true
    error = null
    const url = URL.createObjectURL(file)
    set_source_file(node_id, file, url)
    try {
        const probe = await probe_media(file)
        if (mine !== token) {
            return
        }
        set_source_probe(node_id, file, probe)
    } catch (caught) {
        if (mine !== token) {
            return
        }
        error = caught instanceof ClipError ? caught.message : `Failed to read media: ${(caught as Error).message}`
    } finally {
        if (mine === token) {
            probing = false
        }
    }
}

function handle_remove(): void {
    token += 1
    probing = false
    error = null
    const target = compose_state.nodes.find((candidate) => candidate.id === node_id)
    if (target && target.type === "source") {
        // WHY orphan URL: preview_urls is private, next set_source_file revokes it
        target.data.file = null
        target.data.probe = null
    }
}
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">Source media</h2>
    <!-- svelte-ignore a11y_no_static_element_interactions: inner input is the keyboard path; drop is enhancement only, so no role=button -->
    <div
        class="drop-zone nodrag"
        class:drag-over={is_dragging}
        ondragover={(e) => {
            e.preventDefault()
            e.stopPropagation()
            is_dragging = true
        }}
        ondragleave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
                return
            }
            is_dragging = false
        }}
        ondrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            is_dragging = false
            void handle_file(first_dropped_file(e))
        }}
    >
        <input
            type="file"
            accept="video/*,audio/*"
            onchange={(e) => {
                const file = e.currentTarget.files?.[0] ?? null
                e.currentTarget.value = ""
                void handle_file(file)
            }}
            aria-describedby="compose-source-status"
            disabled={probing}
            class="w-full rounded border border-gray-300 bg-white p-2 text-transparent file:mr-4 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-white hover:file:bg-gray-800"
        >
    </div>
    <p
        id="compose-source-status"
        aria-live="polite"
        class={status_class}
    >
        {#if probing}
            Reading {file_name ?? "file"}…
        {:else if error}
            {error}
        {:else if file_name}
            ✓ Accepted: {file_name}
        {:else}
            No file chosen — select video or audio
        {/if}
    </p>
    {#if file_name}
        <button
            type="button"
            onclick={handle_remove}
            aria-label={`Remove source file ${file_name}`}
            class="self-start text-sm text-red-700 underline"
        >
            Remove
        </button>
    {/if}
</div>
