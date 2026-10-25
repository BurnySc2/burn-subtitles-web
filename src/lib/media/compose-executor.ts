import { find_output_node, topo_sort_compose } from "./compose-graph"
import { srt_to_vtt } from "./compose-subtitles"
import type { ComposeEdge, ComposeNode, ComposeRunResult } from "./compose-types"
import { validate_compose } from "./compose-validation"
import { ClipError, extract_clip } from "./mediabunny-clip"
import { render_merge } from "./mediabunny-merge"
import { render_overlay } from "./mediabunny-overlay"
import { render_rescale } from "./mediabunny-rescale"
import { render_solid_color } from "./mediabunny-solid"
import { render_transition } from "./mediabunny-transition"

export interface ExecuteComposeGraphOptions {
    nodes: ComposeNode[]
    edges: ComposeEdge[]
    on_progress?: (progress: number) => void
    signal?: AbortSignal
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
        source: new mb.BlobSource(blob_to_file(blob, "compose-input")),
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
        await ffmpeg.writeFile("compose-input.mp4", await fetchFile(video))
        await ffmpeg.writeFile("compose-subtitles.srt", srt_content)
        await ffmpeg.exec([
            "-i",
            "compose-input.mp4",
            "-vf",
            "subtitles=compose-subtitles.srt",
            "-c:a",
            "copy",
            "compose-output.mp4",
        ])
        throw_if_aborted(signal)
        const output_data = await ffmpeg.readFile("compose-output.mp4")
        // @ts-expect-error
        return new Blob([(output_data as Uint8Array).buffer], { type: "video/mp4" })
    } finally {
        signal?.removeEventListener("abort", on_abort)
        await ffmpeg.deleteFile("compose-input.mp4").catch(() => {})
        await ffmpeg.deleteFile("compose-subtitles.srt").catch(() => {})
        await ffmpeg.deleteFile("compose-output.mp4").catch(() => {})
        ffmpeg.terminate()
    }
}

export async function execute_compose_graph(options: ExecuteComposeGraphOptions): Promise<ComposeRunResult> {
    const { nodes, edges, on_progress, signal } = options
    throw_if_aborted(signal)
    const issues = validate_compose(nodes, edges)
    if (issues.length > 0) {
        return { ok: false, issues, output: null }
    }
    const order = topo_sort_compose(nodes, edges)
    const by_id = new Map(nodes.map((node) => [node.id, node]))
    const incoming = incoming_by_target(edges)
    const output_node = find_output_node(nodes)
    const memo = new Map<string, Blob>()
    let sidecar_vtt: string | null = null
    const total = Math.max(1, order.length)
    let done = 0
    for (const node_id of order) {
        throw_if_aborted(signal)
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
                memo.set(node.id, node.data.file)
                break
            }
            case "trim": {
                const input = single_input(node.id, incoming, memo)
                const result = await extract_clip({
                    file: blob_to_file(input, "trim-input.mp4"),
                    start: node.data.start,
                    end: node.data.end,
                    output_kind: "mp4",
                    on_progress: slice,
                    signal,
                })
                memo.set(node.id, result.blob)
                break
            }
            case "transition": {
                const { blob_a, blob_b } = transition_inputs(node.id, incoming, memo)
                const result = await render_transition({
                    file_a: blob_to_file(blob_a, "transition-a.mp4"),
                    file_b: blob_to_file(blob_b, "transition-b.mp4"),
                    duration: node.data.duration,
                    start_a: node.data.start,
                    width: output_node?.data.width ?? 1920,
                    height: output_node?.data.height ?? 1080,
                    fps: output_node?.data.fps ?? 30,
                    quality: output_node?.data.quality ?? "medium",
                    crf: output_node?.data.crf ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    easing: node.data.easing,
                    audio_mode: node.data.audio_mode,
                    on_progress: slice,
                    signal,
                })
                memo.set(node.id, result.blob)
                break
            }
            case "merge": {
                const blobs = merge_inputs(node.id, incoming, memo)
                const result = await render_merge({
                    files: blobs.map((blob, index) => blob_to_file(blob, `merge-in${index}.mp4`)),
                    width: output_node?.data.width ?? 1920,
                    height: output_node?.data.height ?? 1080,
                    fps: output_node?.data.fps ?? 30,
                    quality: output_node?.data.quality ?? "medium",
                    crf: output_node?.data.crf ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    on_progress: slice,
                    signal,
                })
                memo.set(node.id, result.blob)
                break
            }
            case "overlay": {
                const input = single_input(node.id, incoming, memo)
                if (!node.data.image) {
                    throw new ClipError("FAILED", "Overlay image is missing.")
                }
                const result = await render_overlay({
                    video: blob_to_file(input, "overlay-bg.mp4"),
                    image: blob_to_file(node.data.image, "overlay.png"),
                    position: node.data.position,
                    scale: node.data.scale,
                    opacity: node.data.opacity,
                    offset_x: node.data.offset_x,
                    offset_y: node.data.offset_y,
                    show_start: node.data.show_start,
                    show_end: node.data.show_end,
                    width: output_node?.data.width ?? 1920,
                    height: output_node?.data.height ?? 1080,
                    fps: output_node?.data.fps ?? 30,
                    quality: output_node?.data.quality ?? "medium",
                    crf: output_node?.data.crf ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    on_progress: slice,
                    signal,
                })
                memo.set(node.id, result.blob)
                break
            }
            case "color": {
                const result = await render_solid_color({
                    color: node.data.color,
                    duration: node.data.duration,
                    width: output_node?.data.width ?? 1920,
                    height: output_node?.data.height ?? 1080,
                    fps: output_node?.data.fps ?? 30,
                    quality: output_node?.data.quality ?? "medium",
                    crf: output_node?.data.crf ?? null,
                    on_progress: (done, total) => slice(total <= 0 ? 1 : done / total),
                    signal,
                })
                memo.set(node.id, result)
                break
            }
            case "rescale": {
                const input = single_input(node.id, incoming, memo)
                const result = await render_rescale(input, {
                    width: node.data.width,
                    height: node.data.height,
                    fps: node.data.fps,
                    fit: node.data.fit,
                    quality: output_node?.data.quality ?? "medium",
                    crf: output_node?.data.crf ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    on_progress: (done, total) => slice(total <= 0 ? 1 : done / total),
                    signal,
                })
                memo.set(node.id, result)
                break
            }
            case "subtitles": {
                const input = single_input(node.id, incoming, memo)
                const content = node.data.content ?? (node.data.file ? await node.data.file.text() : null)
                if (content === null || content.trim() === "") {
                    throw new ClipError("FAILED", "Subtitle content is empty.")
                }
                const vtt = srt_to_vtt(content)
                if (node.data.mode === "burn") {
                    memo.set(node.id, await burn_subtitles_into_video(input, content, signal))
                } else {
                    memo.set(node.id, input)
                    if (node.data.mode === "sidecar") {
                        sidecar_vtt ??= vtt
                    }
                }
                break
            }
            case "output": {
                const input = single_input(node.id, incoming, memo)
                memo.set(node.id, await ensure_mp4_blob(input, signal))
                break
            }
        }
        done += 1
        on_progress?.(done / total)
    }
    const final_blob = output_node ? (memo.get(output_node.id) ?? null) : null
    if (!final_blob) {
        throw new ClipError("FAILED", "Composition produced no output.")
    }
    const sidecar_url = sidecar_vtt === null ? null : URL.createObjectURL(new Blob([sidecar_vtt], { type: "text/vtt" }))
    return {
        ok: true,
        issues: [],
        output: {
            url: URL.createObjectURL(final_blob),
            mime: "video/mp4",
            ext: "mp4",
            size_bytes: final_blob.size,
            sidecar_url,
        },
    }
}
