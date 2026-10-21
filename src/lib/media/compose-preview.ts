import { find_output_node, topo_sort_compose, upstream_of } from "./compose-graph"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { ClipError, extract_clip } from "./mediabunny-clip"
import { render_merge } from "./mediabunny-merge"
import { render_transition } from "./mediabunny-transition"

export interface NodePreviewOptions {
    signal?: AbortSignal
    on_progress?: (progress: number) => void
}

interface PreviewMemoEntry {
    upstream: string
    blob: Blob
}

const preview_memo = new Map<string, PreviewMemoEntry>()

function file_stub_key(file: File | null): string {
    if (!file) {
        return "null"
    }
    return `${file.name}:${file.size}:${file.type}:${file.lastModified}`
}

function serialize_node(node: ComposeNode): string {
    if (node.type === "source") {
        return [node.id, node.type, file_stub_key(node.data.file), JSON.stringify(node.data.probe ?? null)].join(":")
    }
    if (node.type === "subtitles") {
        return [node.id, node.type, file_stub_key(node.data.file), node.data.content ?? "", node.data.mode].join(":")
    }
    return [node.id, node.type, JSON.stringify(node.data)].join(":")
}

function subgraph_fingerprint(target_id: string, nodes: ComposeNode[], edges: ComposeEdge[]): string {
    const by_id = new Map(nodes.map((node) => [node.id, node]))
    const relevant = new Set([...upstream_of(target_id, nodes, edges), target_id])
    const serial_nodes = [...relevant].sort().map((id) => serialize_node(by_id.get(id) as ComposeNode))
    const serial_edges = edges
        .filter((edge) => relevant.has(edge.source) && relevant.has(edge.target))
        .map((edge) => [edge.id, edge.source, edge.target, edge.targetHandle ?? ""].join(":"))
        .sort()
    return JSON.stringify([serial_nodes, serial_edges])
}

export function clear_node_preview_cache(): void {
    preview_memo.clear()
}

function throw_if_aborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
}

function blob_to_file(blob: Blob, name: string): File {
    return blob instanceof File ? blob : new File([blob], name, { type: blob.type })
}

function incoming_by_target(edges: ComposeEdge[]): Map<string, ComposeEdge[]> {
    const incoming = new Map<string, ComposeEdge[]>()
    for (const edge of edges) {
        const list = incoming.get(edge.target) ?? []
        list.push(edge)
        incoming.set(edge.target, list)
    }
    return incoming
}

function single_input(node_id: string, incoming: Map<string, ComposeEdge[]>, memo: Map<string, Blob>): Blob {
    const edges = incoming.get(node_id) ?? []
    const blob = edges.length === 1 ? (memo.get(edges[0].source) ?? null) : null
    if (!blob) {
        throw new ClipError("FAILED", "Node input is missing.")
    }
    return blob
}

function transition_inputs(
    node_id: string,
    incoming: Map<string, ComposeEdge[]>,
    memo: Map<string, Blob>,
): { blob_a: Blob; blob_b: Blob } {
    const edges = incoming.get(node_id) ?? []
    const by_handle = (handle: string): Blob | null => {
        const edge = edges.find((candidate) => candidate.targetHandle === handle) ?? null
        return edge ? (memo.get(edge.source) ?? null) : null
    }
    const fallbacks = edges.map((edge) => memo.get(edge.source)).filter((blob): blob is Blob => blob !== undefined)
    const blob_a = by_handle("a") ?? fallbacks[0] ?? null
    const blob_b = by_handle("b") ?? fallbacks[1] ?? null
    if (!blob_a || !blob_b) {
        throw new ClipError("FAILED", "Transition inputs are missing.")
    }
    return { blob_a, blob_b }
}

function merge_handle_index(handle: string | null): number {
    if (typeof handle !== "string") {
        return Number.MAX_SAFE_INTEGER
    }
    const match = /^in(\d+)$/.exec(handle)
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function merge_inputs(node_id: string, incoming: Map<string, ComposeEdge[]>, memo: Map<string, Blob>): Blob[] {
    const edges = (incoming.get(node_id) ?? []).slice().sort((a, b) => {
        const index_a = merge_handle_index(a.targetHandle)
        const index_b = merge_handle_index(b.targetHandle)
        if (index_a !== index_b) {
            return index_a - index_b
        }
        return a.source < b.source ? -1 : a.source > b.source ? 1 : 0
    })
    const blobs = edges.map((edge) => memo.get(edge.source) ?? null)
    if (blobs.length < 2 || blobs.some((blob) => blob === null)) {
        throw new ClipError("FAILED", "Merge inputs are missing.")
    }
    return blobs as Blob[]
}

async function ensure_mp4_blob(blob: Blob, signal?: AbortSignal): Promise<Blob> {
    if (blob.type === "video/mp4") {
        return blob
    }
    throw_if_aborted(signal)
    const mb = await import("mediabunny")
    const input = new mb.Input({
        formats: mb.ALL_FORMATS,
        source: new mb.BlobSource(blob_to_file(blob, "compose-preview-input")),
    })
    const target = new mb.BufferTarget()
    const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target })
    const on_abort = () => {
        void output.cancel()
    }
    signal?.addEventListener("abort", on_abort, { once: true })
    try {
        if (!(await input.canRead())) {
            throw new ClipError("UNSUPPORTED", "This codec isn't supported for in-browser composing.")
        }
        const conversion = await mb.Conversion.init({ input, output })
        if (signal?.aborted) {
            await conversion.cancel()
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        if (!conversion.isValid) {
            throw new ClipError("UNSUPPORTED", "This codec isn't supported for in-browser composing.")
        }
        try {
            await conversion.execute()
        } catch (error) {
            if (
                error instanceof mb.ConversionCanceledError ||
                (error instanceof Error && error.name === "ConversionCanceledError")
            ) {
                throw new ClipError("CANCELLED", "Cancelled.")
            }
            throw error
        }
        if (!target.buffer) {
            throw new ClipError("FAILED", "Composition produced no output.")
        }
        return new Blob([target.buffer], { type: output.format.mimeType })
    } finally {
        signal?.removeEventListener("abort", on_abort)
        input.dispose()
    }
}

async function burn_subtitles_into_video(video: Blob, srt_content: string, signal?: AbortSignal): Promise<Blob> {
    throw_if_aborted(signal)
    const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")])
    const ffmpeg = new FFmpeg()
    const on_abort = () => {
        ffmpeg.terminate()
    }
    signal?.addEventListener("abort", on_abort, { once: true })
    try {
        const base_url = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm"
        await ffmpeg.load({
            coreURL: await toBlobURL(`${base_url}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${base_url}/ffmpeg-core.wasm`, "application/wasm"),
        })
        throw_if_aborted(signal)
        await ffmpeg.writeFile("compose-preview-input.mp4", await fetchFile(video))
        await ffmpeg.writeFile("compose-preview-subtitles.srt", srt_content)
        await ffmpeg.exec([
            "-i",
            "compose-preview-input.mp4",
            "-vf",
            "subtitles=compose-preview-subtitles.srt",
            "-c:a",
            "copy",
            "compose-preview-output.mp4",
        ])
        throw_if_aborted(signal)
        const output_data = await ffmpeg.readFile("compose-preview-output.mp4")
        // @ts-expect-error
        return new Blob([(output_data as Uint8Array).buffer], { type: "video/mp4" })
    } finally {
        signal?.removeEventListener("abort", on_abort)
        await ffmpeg.deleteFile("compose-preview-input.mp4").catch(() => {})
        await ffmpeg.deleteFile("compose-preview-subtitles.srt").catch(() => {})
        await ffmpeg.deleteFile("compose-preview-output.mp4").catch(() => {})
        ffmpeg.terminate()
    }
}

export async function get_node_preview_blob(
    target_id: string,
    nodes: ComposeNode[],
    edges: ComposeEdge[],
    options: NodePreviewOptions = {},
): Promise<Blob | null> {
    const { signal, on_progress } = options
    throw_if_aborted(signal)
    const by_id = new Map(nodes.map((node) => [node.id, node]))
    const target = by_id.get(target_id)
    if (!target) {
        return null
    }
    const fingerprint = subgraph_fingerprint(target_id, nodes, edges)
    for (const id of [...preview_memo.keys()]) {
        if (!by_id.has(id)) {
            preview_memo.delete(id)
        }
    }
    const cached = preview_memo.get(target_id)
    if (cached && cached.upstream === fingerprint) {
        return cached.blob
    }
    const upstream = upstream_of(target_id, nodes, edges)
    const relevant = new Set([...upstream, target_id])
    const order = topo_sort_compose(nodes, edges).filter((id) => relevant.has(id))
    const incoming = incoming_by_target(edges)
    const blobs = new Map<string, Blob>()
    const store = (node_id: string, blob: Blob): void => {
        blobs.set(node_id, blob)
        preview_memo.set(node_id, { upstream: subgraph_fingerprint(node_id, nodes, edges), blob })
    }
    const output_node = find_output_node(nodes)
    const total = Math.max(1, order.length)
    let done = 0
    for (const node_id of order) {
        throw_if_aborted(signal)
        const memo_hit = preview_memo.get(node_id)
        if (memo_hit && memo_hit.upstream === subgraph_fingerprint(node_id, nodes, edges)) {
            blobs.set(node_id, memo_hit.blob)
            done += 1
            on_progress?.(done / total)
            continue
        }
        const node = by_id.get(node_id)
        if (!node) {
            continue
        }
        const slice = (progress: number) => on_progress?.((done + progress) / total)
        switch (node.type) {
            case "source": {
                if (!node.data.file) {
                    throw new ClipError("FAILED", "Source file is missing.")
                }
                store(node.id, node.data.file)
                break
            }
            case "trim": {
                const input = single_input(node.id, incoming, blobs)
                const result = await extract_clip({
                    file: blob_to_file(input, "trim-input.mp4"),
                    start: node.data.start,
                    end: node.data.end,
                    output_kind: "mp4",
                    on_progress: slice,
                    signal,
                })
                store(node.id, result.blob)
                break
            }
            case "transition": {
                const { blob_a, blob_b } = transition_inputs(node.id, incoming, blobs)
                const result = await render_transition({
                    file_a: blob_to_file(blob_a, "transition-a.mp4"),
                    file_b: blob_to_file(blob_b, "transition-b.mp4"),
                    duration: node.data.duration,
                    start_a: node.data.start,
                    width: output_node?.data.width ?? 1280,
                    height: output_node?.data.height ?? 720,
                    fps: output_node?.data.fps ?? 30,
                    quality: output_node?.data.quality ?? "medium",
                    crf: output_node?.data.crf ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    easing: node.data.easing,
                    on_progress: slice,
                    signal,
                })
                store(node.id, result.blob)
                break
            }
            case "subtitles": {
                const input = single_input(node.id, incoming, blobs)
                const content = node.data.content ?? (node.data.file ? await node.data.file.text() : null)
                if (content === null || content.trim() === "") {
                    throw new ClipError("FAILED", "Subtitle content is empty.")
                }
                if (node.data.mode === "burn") {
                    store(node.id, await burn_subtitles_into_video(input, content, signal))
                } else {
                    store(node.id, input)
                }
                break
            }
            case "merge": {
                const merged = merge_inputs(node.id, incoming, blobs)
                const result = await render_merge({
                    files: merged.map((blob, index) => blob_to_file(blob, `merge-in${index}.mp4`)),
                    width: output_node?.data.width ?? 1280,
                    height: output_node?.data.height ?? 720,
                    fps: output_node?.data.fps ?? 30,
                    quality: output_node?.data.quality ?? "medium",
                    crf: output_node?.data.crf ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    on_progress: slice,
                    signal,
                })
                store(node.id, result.blob)
                break
            }
            case "output": {
                const input = single_input(node.id, incoming, blobs)
                store(node.id, await ensure_mp4_blob(input, signal))
                break
            }
        }
        done += 1
        on_progress?.(done / total)
    }
    return blobs.get(target_id) ?? null
}
