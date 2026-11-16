import {
    blob_to_file,
    build_fused_dispatch,
    execute_fused_segment as execute_shared_fused_segment,
    type FusedDispatch,
    single_input,
} from "./compose-fused"
import { type ComposeOutputNode, find_output_node, topo_sort_compose } from "./compose-graph"
import { peak_audio_probe, union_probe_lists } from "./compose-probe-union"
import { normalize_subtitle_style, SubtitleError, srt_to_vtt } from "./compose-subtitles"
import {
    node_output_duration,
    pred_by_handle,
    resolve_trim_range,
    trim_range_error,
    trim_upstream_duration,
} from "./compose-trim"
import type { ComposeEdge, ComposeNode, ComposeRunResult } from "./compose-types"
import { validate_compose } from "./compose-validation"
import { ClipError, extract_clip, type ProbeResult, probe_media } from "./mediabunny-clip"
import { collect_stack_segments } from "./mediabunny-compose-stack"
import { render_merge } from "./mediabunny-merge"
import { render_overlay } from "./mediabunny-overlay"
import { render_rescale } from "./mediabunny-rescale"
import { render_solid_color } from "./mediabunny-solid"
import { render_subtitles_burn } from "./mediabunny-subtitles"
import { render_text_overlay } from "./mediabunny-text-overlay"
import { render_transition } from "./mediabunny-transition"
import { resolve_audio_bitrate, resolve_output_video_config } from "./transition-utils"

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

async function execute_fused_segment(
    dispatch: FusedDispatch,
    by_id: Map<string, ComposeNode>,
    incoming: Map<string, ComposeEdge[]>,
    memo: Map<string, Blob>,
    output_node: ComposeOutputNode | null,
    on_slice: (progress: number) => void,
    signal?: AbortSignal,
): Promise<Blob> {
    const blob = await execute_shared_fused_segment(dispatch, by_id, incoming, memo, output_node, on_slice, signal)
    return blob
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

function single_probe_list(
    node_id: string,
    incoming: Map<string, ComposeEdge[]>,
    probe_memo: Map<string, ProbeResult[]>,
): ProbeResult[] {
    const edges = incoming.get(node_id) ?? []
    if (edges.length !== 1) {
        return []
    }
    return [...(probe_memo.get(edges[0].source) ?? [])]
}

function transition_probe_lists(
    node_id: string,
    incoming: Map<string, ComposeEdge[]>,
    probe_memo: Map<string, ProbeResult[]>,
): { list_a: ProbeResult[]; list_b: ProbeResult[] } {
    const edges = incoming.get(node_id) ?? []
    const by_handle = (handle: string): ProbeResult[] | null => {
        const edge = edges.find((candidate) => candidate.targetHandle === handle) ?? null
        if (!edge) {
            return null
        }
        const list = probe_memo.get(edge.source)
        return list ? [...list] : null
    }
    const fallbacks = edges.map((edge) => [...(probe_memo.get(edge.source) ?? [])])
    return { list_a: by_handle("a") ?? fallbacks[0] ?? [], list_b: by_handle("b") ?? fallbacks[1] ?? [] }
}

function merge_probe_lists(
    node_id: string,
    incoming: Map<string, ComposeEdge[]>,
    probe_memo: Map<string, ProbeResult[]>,
): Array<readonly ProbeResult[] | null | undefined> {
    const edges = (incoming.get(node_id) ?? []).slice().sort((a, b) => {
        const index_a = merge_handle_index(a.targetHandle)
        const index_b = merge_handle_index(b.targetHandle)
        if (index_a !== index_b) {
            return index_a - index_b
        }
        return a.source < b.source ? -1 : a.source > b.source ? 1 : 0
    })
    return edges.map((edge) => probe_memo.get(edge.source))
}

function peak_probe_for_render(list: readonly ProbeResult[]): ProbeResult | null {
    const valid = list.filter((probe): probe is ProbeResult => probe !== null && probe !== undefined)
    const base = valid[0] ?? null
    if (!base) {
        return null
    }
    const peak = peak_audio_probe(valid)
    if (!peak || (base.audio_bitrate === peak.audio_bitrate && base.overall_bitrate === peak.overall_bitrate)) {
        return base
    }
    return { ...base, audio_bitrate: peak.audio_bitrate, overall_bitrate: peak.overall_bitrate }
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
    const probe_memo = new Map<string, ProbeResult[]>()
    const video_config = output_node ? resolve_output_video_config(output_node.data) : null
    const total = Math.max(1, order.length)
    let done = 0
    const fused_dispatch = build_fused_dispatch(collect_stack_segments(nodes, edges), by_id, output_node?.id ?? null)
    for (const node_id of order) {
        throw_if_aborted(signal)
        const node = by_id.get(node_id)
        if (!node) {
            continue
        }
        const fused = fused_dispatch.get(node_id) ?? null
        if (fused?.fused_ids.has(node_id) && node_id !== fused.end_id) {
            continue
        }
        if (fused && node_id === fused.end_id) {
            const span_slice = (progress: number) => on_progress?.((done + progress * fused.span) / total)
            const blob = await execute_fused_segment(fused, by_id, incoming, memo, output_node, span_slice, signal)
            // WHY fused-output-probes: attribute the segment's external input probes to every fused id so downstream peaking still sees source probes.
            const fused_union = union_probe_lists(
                fused.segment.node_ids.flatMap((id) =>
                    (incoming.get(id) ?? []).map((edge) => probe_memo.get(edge.source)),
                ),
            )
            for (const fused_id of fused.fused_ids) {
                memo.set(fused_id, blob)
                probe_memo.set(fused_id, [...fused_union])
            }
            done += fused.span
            on_progress?.(done / total)
            continue
        }
        const slice = (progress: number) => on_progress?.((done + progress) / total)
        switch (node.type) {
            case "source": {
                if (!node.data.file) {
                    throw new ClipError("FAILED", "Source file is missing.")
                }
                memo.set(node.id, node.data.file)
                if (node.data.probe) {
                    probe_memo.set(node.id, [node.data.probe])
                } else {
                    let probed: ProbeResult | null = null
                    try {
                        probed = await probe_media(node.data.file)
                    } catch {
                        probed = null
                    }
                    probe_memo.set(node.id, probed ? [probed] : [])
                }
                break
            }
            case "trim": {
                const input = single_input(node.id, incoming, memo)
                const resolved = resolve_trim_range(node.data, trim_upstream_duration(node.id, by_id, incoming))
                if (!resolved.ok) {
                    trim_range_error(resolved.reason)
                }
                const result = await extract_clip({
                    file: blob_to_file(input, "trim-input.mp4"),
                    start: resolved.start,
                    end: resolved.end,
                    output_kind: "mp4",
                    on_progress: slice,
                    signal,
                })
                memo.set(node.id, result.blob)
                probe_memo.set(node.id, single_probe_list(node.id, incoming, probe_memo))
                break
            }
            case "transition": {
                const { blob_a, blob_b } = transition_inputs(node.id, incoming, memo)
                const { list_a, list_b } = transition_probe_lists(node.id, incoming, probe_memo)
                probe_memo.set(node.id, union_probe_lists([list_a, list_b]))
                const base_a = peak_probe_for_render(list_a)
                const base_b = peak_probe_for_render(list_b)
                const pred_a = pred_by_handle(node.id, "a", incoming)
                const pred_b = pred_by_handle(node.id, "b", incoming)
                const dur_a = pred_a
                    ? node_output_duration(pred_a, by_id, incoming, new Map<string, number | null>(), new Set<string>())
                    : null
                const dur_b = pred_b
                    ? node_output_duration(pred_b, by_id, incoming, new Map<string, number | null>(), new Set<string>())
                    : null
                // WHY duration-or-null: stale probe durations trip false INVALID_RANGE, null probes actual bytes.
                const probe_a = base_a && dur_a !== null ? { ...base_a, duration: dur_a } : null
                const probe_b = base_b && dur_b !== null ? { ...base_b, duration: dur_b } : null
                const result = await render_transition({
                    file_a: blob_to_file(blob_a, "transition-a.mp4"),
                    file_b: blob_to_file(blob_b, "transition-b.mp4"),
                    probe_a,
                    probe_b,
                    duration: node.data.duration,
                    start_a: node.data.start,
                    width: output_node?.data.width ?? 1920,
                    height: output_node?.data.height ?? 1080,
                    fps: output_node?.data.fps ?? 30,
                    quality: "medium",
                    video_bitrate: video_config?.bitrate ?? null,
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
                const merged_union = union_probe_lists(merge_probe_lists(node.id, incoming, probe_memo))
                probe_memo.set(node.id, merged_union)
                const result = await render_merge({
                    files: blobs.map((blob, index) => blob_to_file(blob, `merge-in${index}.mp4`)),
                    width: output_node?.data.width ?? 1920,
                    height: output_node?.data.height ?? 1080,
                    fps: output_node?.data.fps ?? 30,
                    quality: "medium",
                    video_bitrate: video_config?.bitrate ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    audio_probe: peak_audio_probe(merged_union),
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
                    quality: "medium",
                    video_bitrate: video_config?.bitrate ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    on_progress: slice,
                    signal,
                })
                memo.set(node.id, result.blob)
                probe_memo.set(node.id, single_probe_list(node.id, incoming, probe_memo))
                break
            }
            case "text": {
                const input = single_input(node.id, incoming, memo)
                const result = await render_text_overlay({
                    video: blob_to_file(input, "text-bg.mp4"),
                    items: node.data.items,
                    width: output_node?.data.width ?? 1920,
                    height: output_node?.data.height ?? 1080,
                    fps: output_node?.data.fps ?? 30,
                    quality: "medium",
                    video_bitrate: video_config?.bitrate ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    on_progress: slice,
                    signal,
                })
                memo.set(node.id, result.blob)
                probe_memo.set(node.id, single_probe_list(node.id, incoming, probe_memo))
                break
            }
            case "color": {
                const result = await render_solid_color({
                    color: node.data.color,
                    duration: node.data.duration,
                    width: output_node?.data.width ?? 1920,
                    height: output_node?.data.height ?? 1080,
                    fps: output_node?.data.fps ?? 30,
                    quality: "medium",
                    video_bitrate: video_config?.bitrate ?? null,
                    on_progress: (done, total) => slice(total <= 0 ? 1 : done / total),
                    signal,
                })
                memo.set(node.id, result)
                probe_memo.set(node.id, [])
                break
            }
            case "rescale": {
                const input = single_input(node.id, incoming, memo)
                const result = await render_rescale(input, {
                    width: node.data.width,
                    height: node.data.height,
                    fps: node.data.fps,
                    fit: node.data.fit,
                    quality: "medium",
                    video_bitrate: video_config?.bitrate ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    on_progress: (done, total) => slice(total <= 0 ? 1 : done / total),
                    signal,
                })
                memo.set(node.id, result)
                probe_memo.set(node.id, single_probe_list(node.id, incoming, probe_memo))
                break
            }
            case "subtitles": {
                const input = single_input(node.id, incoming, memo)
                const srt_content = node.data.file ? await node.data.file.text() : null
                if (srt_content === null) {
                    throw new ClipError("FAILED", "Subtitle file is required.")
                }
                if (srt_content.trim() === "") {
                    throw new ClipError("FAILED", "Subtitle file is empty.")
                }
                try {
                    srt_to_vtt(srt_content)
                } catch (error) {
                    if (error instanceof SubtitleError) {
                        throw new ClipError("FAILED", error.message)
                    }
                    throw error
                }
                const style = normalize_subtitle_style(node.data)
                memo.set(
                    node.id,
                    await render_subtitles_burn(
                        blob_to_file(input, "burn-input.mp4"),
                        {
                            srt_content,
                            ...style,
                            width: output_node?.data.width ?? 1920,
                            height: output_node?.data.height ?? 1080,
                            fps: output_node?.data.fps ?? 30,
                            quality: "medium",
                            video_bitrate: video_config?.bitrate ?? null,
                            audio_quality: output_node?.data.audio_quality ?? "source-max",
                            on_progress: slice,
                        },
                        signal,
                    ),
                )
                probe_memo.set(node.id, single_probe_list(node.id, incoming, probe_memo))
                break
            }
            case "output": {
                const input = single_input(node.id, incoming, memo)
                const upstream = single_probe_list(node.id, incoming, probe_memo)
                memo.set(node.id, await ensure_mp4_blob(input, signal))
                probe_memo.set(node.id, upstream)
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
    const upstream = output_node ? (probe_memo.get(output_node.id) ?? []) : []
    const audio_bitrate_bps = output_node
        ? resolve_audio_bitrate(
              peak_audio_probe(union_probe_lists([upstream])),
              null,
              output_node.data.audio_quality ?? "source-max",
          )
        : null
    return {
        ok: true,
        issues: [],
        output: {
            url: URL.createObjectURL(final_blob),
            mime: "video/mp4",
            ext: "mp4",
            size_bytes: final_blob.size,
            audio_bitrate_bps,
        },
    }
}
