<script lang="ts">
import ComposeFileDrop from "$lib/components/feature/compose/ComposeFileDrop.svelte"
import { handle_accepted_file } from "$lib/media/compose-file-handler"
import { clear_preview_url, compose_state, set_source_file, set_source_probe } from "$lib/media/compose-state.svelte"
import { ClipError, probe_media } from "$lib/media/mediabunny-clip"

let { node_id }: { node_id: string } = $props()

let probing = $state(false)
let error = $state<string | null>(null)
let token = { n: 0 }

let node = $derived(compose_state.nodes.find((candidate) => candidate.id === node_id) ?? null)
let file_name = $derived(node && node.type === "source" ? (node.data.file?.name ?? null) : null)
let choose_label = $derived(file_name ? "Replace file" : "Choose file")
let choose_aria = $derived(file_name ? "Replace source media" : "Choose source media")
let show_remove = $derived(file_name !== null)
let remove_aria = $derived(file_name ? `Remove source file ${file_name}` : "Remove source file")

let status_class = $derived(
    error ? "text-sm text-red-700" : file_name ? "text-sm font-medium text-green-700" : "text-sm text-gray-500",
)

async function handle_file(file: File | null): Promise<void> {
    if (!file) {
        return
    }
    const accepted: File = file
    await handle_accepted_file({
        file: accepted,
        kind: "source",
        token,
        on_accept: async (mine) => {
            probing = true
            error = null
            const url = URL.createObjectURL(accepted)
            set_source_file(node_id, accepted, url)
            try {
                const probe = await probe_media(accepted)
                if (mine !== token.n) {
                    return
                }
                set_source_probe(node_id, accepted, probe)
            } catch (caught) {
                if (mine !== token.n) {
                    return
                }
                clear_preview_url(node_id)
                const target = compose_state.nodes.find((candidate) => candidate.id === node_id)
                if (target && target.type === "source") {
                    target.data.file = null
                    target.data.probe = null
                }
                if (caught instanceof ClipError) {
                    error = caught.message
                } else if (caught instanceof Error) {
                    error = `Failed to read media: ${caught.message}`
                } else {
                    error = "Failed to read media"
                }
            } finally {
                if (mine === token.n) {
                    probing = false
                }
            }
        },
        on_reject: (message) => {
            token.n += 1
            clear_preview_url(node_id)
            const target = compose_state.nodes.find((candidate) => candidate.id === node_id)
            if (target && target.type === "source") {
                target.data.file = null
                target.data.probe = null
            }
            error = message
            probing = false
        },
    })
}

function handle_remove(): void {
    token.n += 1
    probing = false
    error = null
    clear_preview_url(node_id)
    const target = compose_state.nodes.find((candidate) => candidate.id === node_id)
    if (target && target.type === "source") {
        target.data.file = null
        target.data.probe = null
    }
}
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">Source media</h2>
    <ComposeFileDrop
        accept="video/*,audio/*"
        {choose_label}
        {choose_aria}
        {file_name}
        {show_remove}
        {remove_aria}
        describedby="compose-source-status"
        disabled={probing}
        on_file={handle_file}
        on_remove={handle_remove}
    />
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
