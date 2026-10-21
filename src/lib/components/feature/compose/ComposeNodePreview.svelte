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

$effect(() => {
    const target = node_id
    const nodes = compose_state.nodes
    const edges = compose_state.edges
    const signature = nodes
        .map((node) => {
            const file_key =
                node.type === "source" || node.type === "subtitles"
                    ? `${node.data.file?.name ?? ""}:${node.data.file?.size ?? 0}:${node.data.file?.lastModified ?? 0}`
                    : ""
            return `${node.id}:${node.type}:${file_key}:${JSON.stringify({ ...node.data, file: null })}`
        })
        .join("|")
    const edge_signature = edges
        .map((edge) => `${edge.id}:${edge.source}:${edge.target}:${edge.targetHandle ?? ""}`)
        .join("|")
    const mine = ++run_token
    cleanup()
    if (!target) {
        loading = false
        error = null
        progress = 0
        notify()
        return
    }
    // WHY await: track signature reads above so graph edits retrigger preview
    void signature
    void edge_signature
    loading = true
    error = null
    progress = 0
    notify()
    aborter = new AbortController()
    const active = aborter
    void (async () => {
        try {
            const result = await get_node_preview_blob(target, [...nodes], [...edges], {
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
    })()
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
    <h3 class="text-sm font-semibold">Node preview</h3>
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
        <p class="text-sm text-gray-500">No preview available for this node.</p>
    {/if}
</div>
