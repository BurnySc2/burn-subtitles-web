<script lang="ts">
import { set_source_file, set_source_probe } from "$lib/media/compose-state.svelte"
import { ClipError, probe_media } from "$lib/media/mediabunny-clip"

let { node_id }: { node_id: string } = $props()

let probing = $state(false)
let error = $state<string | null>(null)
let file_name = $state<string | null>(null)
let token = 0

let status_class = $derived(
    error ? "text-sm text-red-700" : file_name ? "text-sm font-medium text-green-700" : "text-sm text-gray-500",
)

async function handle_file(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
        return
    }
    const mine = ++token
    probing = true
    error = null
    file_name = file.name
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
        input.value = ""
    }
}
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">Source media</h2>
    <input
        type="file"
        accept="video/*,audio/*"
        onchange={(e) => void handle_file(e)}
        aria-describedby="compose-source-status"
        disabled={probing}
        class="w-full rounded border border-gray-300 bg-white p-2 text-transparent file:mr-4 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-white hover:file:bg-gray-800"
    >
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
</div>
