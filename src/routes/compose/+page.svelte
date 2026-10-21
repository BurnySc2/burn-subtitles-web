<script lang="ts">
import { onDestroy } from "svelte"
import ComposeCanvas from "$lib/components/feature/compose/ComposeCanvas.svelte"
import ComposeInspector from "$lib/components/feature/compose/ComposeInspector.svelte"
import ComposeIssuesPanel from "$lib/components/feature/compose/ComposeIssuesPanel.svelte"
import ComposeJsonBar from "$lib/components/feature/compose/ComposeJsonBar.svelte"
import ComposePalette from "$lib/components/feature/compose/ComposePalette.svelte"
import ComposeRenderBar from "$lib/components/feature/compose/ComposeRenderBar.svelte"
import { execute_compose_graph } from "$lib/media/compose-executor"
import { compose_filename } from "$lib/media/compose-filename"
import { compose_state, flow_center_position } from "$lib/media/compose-state.svelte"
import type { ComposeNode, ComposeNodeKind } from "$lib/media/compose-types"
import { validate_compose } from "$lib/media/compose-validation"
import { ClipError } from "$lib/media/mediabunny-clip"

let aborter: AbortController | null = null

function handle_add(kind: ComposeNodeKind): void {
    if (compose_state.run_status === "running") {
        return
    }
    const id = crypto.randomUUID()
    const center = flow_center_position()
    const position = {
        x: Math.round(center.x + (Math.random() * 120 - 60)),
        y: Math.round(center.y + (Math.random() * 120 - 60)),
    }
    let node: ComposeNode
    switch (kind) {
        case "source":
            node = { id, type: "source", position, data: { file: null, probe: null } }
            break
        case "trim":
            node = { id, type: "trim", position, data: { start: 0, end: 1 } }
            break
        case "transition":
            node = { id, type: "transition", position, data: { start: 0, duration: 1, easing: "linear" } }
            break
        case "merge":
            node = { id, type: "merge", position, data: { input_count: 2 } }
            break
        case "subtitles":
            node = { id, type: "subtitles", position, data: { file: null, content: null, mode: "mux" } }
            break
        case "output":
            node = {
                id,
                type: "output",
                position,
                data: {
                    file_name: null,
                    width: 1280,
                    height: 720,
                    fps: 30,
                    quality: "medium",
                    audio_quality: "source-max",
                    crf: null,
                },
            }
            break
    }
    compose_state.nodes.push(node)
    compose_state.selected_id = id
    compose_state.selected_edge_id = null
}

async function handle_render(): Promise<void> {
    if (compose_state.run_status === "running") {
        return
    }
    const issues = validate_compose(compose_state.nodes, compose_state.edges)
    if (issues.length > 0) {
        compose_state.run_status = "error"
        compose_state.run_error = `${issues.length} issue${issues.length === 1 ? "" : "s"} — see issues below canvas`
        return
    }
    aborter?.abort()
    if (compose_state.result) {
        URL.revokeObjectURL(compose_state.result.url)
        if (compose_state.result.sidecar_url) {
            URL.revokeObjectURL(compose_state.result.sidecar_url)
        }
        compose_state.result = null
    }
    compose_state.run_status = "running"
    compose_state.run_progress = 0
    compose_state.run_error = null
    aborter = new AbortController()
    try {
        const result = await execute_compose_graph({
            nodes: compose_state.nodes,
            edges: compose_state.edges,
            on_progress: (progress) => {
                compose_state.run_progress = progress
            },
            signal: aborter.signal,
        })
        if (!result.ok || !result.output) {
            compose_state.run_status = "error"
            compose_state.run_error = result.issues[0]?.message ?? "Composition failed."
            return
        }
        compose_state.result = {
            url: result.output.url,
            mime: result.output.mime,
            ext: result.output.ext,
            sidecar_url: result.output.sidecar_url,
        }
        compose_state.run_status = "done"
    } catch (error) {
        if (error instanceof ClipError && error.code === "CANCELLED") {
            compose_state.run_status = "idle"
        } else {
            compose_state.run_status = "error"
            compose_state.run_error = error instanceof Error ? error.message : "Composition failed."
        }
    } finally {
        aborter = null
    }
}

function handle_cancel(): void {
    aborter?.abort()
}

let download_name = $derived.by(() => {
    if (!compose_state.result) {
        return compose_filename("composition", "mp4")
    }
    let stem = "composition"
    for (const node of compose_state.nodes) {
        if (node.type === "output" && node.data.file_name?.trim()) {
            stem = node.data.file_name
        }
    }
    return compose_filename(stem, compose_state.result.ext)
})

let sidecar_name = $derived.by(() => {
    if (!compose_state.result?.sidecar_url) {
        return compose_filename("composition", "vtt")
    }
    let stem = "composition"
    for (const node of compose_state.nodes) {
        if (node.type === "output" && node.data.file_name?.trim()) {
            stem = node.data.file_name
        }
    }
    return compose_filename(stem, "vtt")
})

onDestroy(() => {
    aborter?.abort()
    if (compose_state.result) {
        URL.revokeObjectURL(compose_state.result.url)
        if (compose_state.result.sidecar_url) {
            URL.revokeObjectURL(compose_state.result.sidecar_url)
        }
        compose_state.result = null
    }
})
</script>

<div class="flex w-full flex-col gap-4 p-4">
    <h1 class="text-2xl font-bold">Compose</h1>
    <ComposeJsonBar />
    <div class="flex w-full gap-4">
        <div class="w-[220px] shrink-0"><ComposePalette on_add={handle_add} /></div>
        <div class="min-w-0 flex-1 rounded-lg bg-gray-100 p-4"><ComposeCanvas /></div>
        <div class="w-80 shrink-0"><ComposeInspector /></div>
    </div>
    <ComposeIssuesPanel />
    <ComposeRenderBar
        on_render={() => void handle_render()}
        on_cancel={handle_cancel}
    />
    {#if compose_state.result}
        <div class="flex flex-col gap-2 rounded-lg bg-gray-100 p-4">
            <h2 class="text-lg font-semibold">Result</h2>
            <video
                src={compose_state.result.url}
                controls
                class="w-full rounded"
            >
                <track
                    kind="captions"
                    src={compose_state.result.sidecar_url}
                    srclang="en"
                    label="English"
                >
            </video>
            <a
                href={compose_state.result.url}
                download={download_name}
                class="btn btn-primary inline-flex items-center justify-center"
            >
                Download {download_name}
            </a>
            {#if compose_state.result.sidecar_url}
                <a
                    href={compose_state.result.sidecar_url}
                    download={sidecar_name}
                    class="btn btn-secondary inline-flex items-center justify-center"
                >
                    Download {sidecar_name}
                </a>
            {/if}
        </div>
    {/if}
</div>
