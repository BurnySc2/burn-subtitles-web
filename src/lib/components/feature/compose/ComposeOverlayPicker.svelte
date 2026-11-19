<script lang="ts">
import { onDestroy } from "svelte"
import ComposeFileDrop from "$lib/components/feature/compose/ComposeFileDrop.svelte"
import { handle_accepted_file } from "$lib/media/compose-file-handler"
import { compose_state } from "$lib/media/compose-state.svelte"
import type { ImageProbe } from "$lib/media/mediabunny-overlay"

let { node_id }: { node_id: string } = $props()

let thumb_url = $state<string | null>(null)
let probe = $state<ImageProbe | null>(null)
let probing = $state(false)
let running = $derived(compose_state.run_status === "running")
let error = $state<string | null>(null)
let token = { n: 0 }

let node = $derived(compose_state.nodes.find((candidate) => candidate.id === node_id) ?? null)
let file_name = $derived(node && node.type === "overlay" ? (node.data.image?.name ?? null) : null)
let choose_label = $derived(file_name ? "Replace file" : "Choose file")
let choose_aria = $derived(file_name ? "Replace overlay image" : "Choose overlay image")
let show_remove = $derived(file_name !== null)
let remove_aria = $derived(file_name ? `Remove overlay image ${file_name}` : "Remove overlay image")

let status_class = $derived(
    error ? "text-sm text-red-700" : file_name ? "text-sm font-medium text-green-700" : "text-sm text-gray-500",
)

function revoke_thumb(): void {
    if (thumb_url) {
        URL.revokeObjectURL(thumb_url)
        thumb_url = null
    }
}

async function handle_file(file: File | null): Promise<void> {
    if (running) {
        return
    }
    if (!file) {
        return
    }
    const target = file
    const selected = compose_state.nodes.find((candidate) => candidate.id === node_id)
    if (selected?.type !== "overlay") {
        return
    }
    await handle_accepted_file({
        file: target,
        kind: "overlay",
        token,
        on_accept: async (mine) => {
            const current = compose_state.nodes.find((candidate) => candidate.id === node_id)
            if (current?.type !== "overlay") {
                return
            }
            probing = true
            error = null
            probe = null
            revoke_thumb()
            thumb_url = URL.createObjectURL(target)
            current.data.image = target
            try {
                const { probe_image } = await import("$lib/media/mediabunny-overlay")
                const result = await probe_image(target)
                if (mine !== token.n) {
                    return
                }
                probe = result
            } finally {
                if (mine === token.n) {
                    probing = false
                }
            }
        },
        on_reject: (message) => {
            token.n += 1
            probe = null
            revoke_thumb()
            const current = compose_state.nodes.find((candidate) => candidate.id === node_id)
            if (current && current.type === "overlay") {
                current.data.image = null
            }
            error = message
            probing = false
        },
    })
}

function handle_remove(): void {
    if (running) {
        return
    }
    token.n += 1
    probing = false
    error = null
    probe = null
    revoke_thumb()
    const target = compose_state.nodes.find((candidate) => candidate.id === node_id)
    if (target && target.type === "overlay") {
        target.data.image = null
    }
}

onDestroy(() => {
    token.n += 1
    revoke_thumb()
})
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">Overlay image</h2>
    <ComposeFileDrop
        accept="image/*"
        {choose_label}
        {choose_aria}
        {file_name}
        {show_remove}
        {remove_aria}
        describedby="compose-overlay-status"
        disabled={probing || running}
        on_file={handle_file}
        on_remove={handle_remove}
    />
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
