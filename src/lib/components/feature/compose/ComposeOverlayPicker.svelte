<script lang="ts">
import { onDestroy } from "svelte"
import { compose_state } from "$lib/media/compose-state.svelte"
import { type ImageProbe, probe_image } from "$lib/media/mediabunny-overlay"

let { node_id }: { node_id: string } = $props()

let thumb_url = $state<string | null>(null)
let probe = $state<ImageProbe | null>(null)
let probing = $state(false)
let error = $state<string | null>(null)
let token = 0

let node = $derived(compose_state.nodes.find((candidate) => candidate.id === node_id) ?? null)
let file_name = $derived(node && node.type === "overlay" ? (node.data.image?.name ?? null) : null)

let status_class = $derived(
    error ? "text-sm text-red-700" : file_name ? "text-sm font-medium text-green-700" : "text-sm text-gray-500",
)

function revoke_thumb(): void {
    if (thumb_url) {
        URL.revokeObjectURL(thumb_url)
        thumb_url = null
    }
}

async function handle_file(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
        return
    }
    const target = compose_state.nodes.find((candidate) => candidate.id === node_id)
    if (!target || target.type !== "overlay") {
        return
    }
    const mine = ++token
    probing = true
    error = null
    probe = null
    revoke_thumb()
    if (!file.type.startsWith("image/")) {
        target.data.image = null
        error = "Please select an image file."
        probing = false
        input.value = ""
        return
    }
    thumb_url = URL.createObjectURL(file)
    target.data.image = file
    try {
        const result = await probe_image(file)
        if (mine !== token) {
            return
        }
        probe = result
    } catch (caught) {
        if (mine !== token) {
            return
        }
        target.data.image = null
        revoke_thumb()
        error = caught instanceof Error ? caught.message : "Failed to read image."
    } finally {
        if (mine === token) {
            probing = false
        }
        input.value = ""
    }
}

onDestroy(() => {
    token += 1
    revoke_thumb()
})
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">Overlay image</h2>
    <input
        type="file"
        accept="image/*"
        onchange={(e) => void handle_file(e)}
        aria-describedby="compose-overlay-status"
        disabled={probing}
        class="w-full rounded border border-gray-300 bg-white p-2 text-transparent file:mr-4 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-white hover:file:bg-gray-800"
    >
    {#if thumb_url}
        <img
            src={thumb_url}
            alt={file_name ?? "Overlay preview"}
            class="max-h-40 w-full rounded border border-gray-200 bg-white object-contain"
        >
    {/if}
    <p
        id="compose-overlay-status"
        aria-live="polite"
        class={status_class}
    >
        {#if probing}
            Reading {file_name ?? "file"}…
        {:else if error}
            {error}
        {:else if file_name}
            ✓ Accepted: {file_name}{probe ? ` · ${probe.width}x${probe.height}` : ""}
        {:else}
            No file chosen — select an image
        {/if}
    </p>
</div>
