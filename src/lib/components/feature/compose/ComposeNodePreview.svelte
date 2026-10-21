<script lang="ts">
import { onDestroy } from "svelte"
import { get_node_preview_blob } from "$lib/media/compose-preview"
import { compose_state } from "$lib/media/compose-state.svelte"

let {
    node_id,
    on_preview,
}: {
    node_id: string | null
    on_preview?: (preview: { url: string | null; blob: Blob | null }) => void
} = $props()

let url = $state<string | null>(null)
let blob = $state<Blob | null>(null)
let loading = $state(false)
let error = $state<string | null>(null)
let progress = $state(0)
let run_token = 0
let aborter: AbortController | null = null

function cleanup(): void {
    aborter?.abort()
    aborter = null
    if (url) {
        URL.revokeObjectURL(url)
        url = null
    }
    blob = null
}

function notify(): void {
    on_preview?.({ url, blob })
}

function cancel_preview(): void {
    run_token += 1
    aborter?.abort()
    aborter = null
    loading = false
    progress = 0
}

async function request_preview(): Promise<void> {
    const target = node_id
    if (!target || loading) {
        return
    }
    const mine = ++run_token
    cleanup()
    loading = true
    error = null
    progress = 0
    notify()
    aborter = new AbortController()
    const active = aborter
    const nodes = [...compose_state.nodes]
    const edges = [...compose_state.edges]
    try {
        const result = await get_node_preview_blob(target, nodes, edges, {
            signal: active.signal,
            on_progress: (value) => {
                if (mine === run_token) {
                    progress = value
                }
            },
        })
        if (mine !== run_token || active.signal.aborted) {
            return
        }
        if (!result) {
            error = "No preview available for this node."
            loading = false
            notify()
            return
        }
        blob = result
        url = URL.createObjectURL(result)
        loading = false
        notify()
    } catch (caught) {
        if (mine !== run_token) {
            return
        }
        if (caught instanceof DOMException && caught.name === "AbortError") {
            return
        }
        if (caught instanceof Error && caught.name === "ClipError" && caught.message === "Cancelled.") {
            return
        }
        error = caught instanceof Error ? caught.message : "Preview failed."
        loading = false
        notify()
    }
}

$effect(() => {
    void node_id
    cancel_preview()
    cleanup()
    error = null
    notify()
})

onDestroy(() => {
    run_token += 1
    if (url) {
        URL.revokeObjectURL(url)
        url = null
    }
    aborter?.abort()
    aborter = null
})

let is_audio = $derived((blob?.type ?? "").startsWith("audio/"))
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-white p-3">
    <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">Node preview</h3>
        {#if node_id}
            {#if loading}
                <button
                    type="button"
                    onclick={cancel_preview}
                    class="btn btn-sm bg-red-600 text-white transition-colors hover:bg-red-700"
                >
                    Cancel
                </button>
            {:else}
                <button
                    type="button"
                    onclick={() => void request_preview()}
                    class="btn btn-primary btn-sm"
                >
                    Preview
                </button>
            {/if}
        {/if}
    </div>
    {#if !node_id}
        <p class="text-sm text-gray-500">Select a node to preview its output.</p>
    {:else if loading}
        <p class="text-sm text-gray-500">Rendering preview… {Math.round(progress * 100)}%</p>
    {:else if error}
        <p class="text-sm text-red-700">{error}</p>
    {:else if url}
        {#if is_audio}
            <audio
                src={url}
                controls
                class="w-full"
            >
                <track kind="captions">
            </audio>
        {:else}
            <video
                src={url}
                controls
                class="w-full rounded"
            >
                <track kind="captions">
            </video>
        {/if}
    {:else}
        <p class="text-sm text-gray-500">Press Preview to render this node.</p>
    {/if}
</div>
