import { font_cache_key } from "./compose-font-library"
import { blob_to_file, build_fused_dispatch, execute_fused_segment, single_input } from "./compose-fused"
import { find_output_node, topo_sort_compose, upstream_of } from "./compose-graph"
import { build_downstream_refcounts, build_fused_canonical, drain_consumed_predecessors } from "./compose-memory"
import { peak_audio_probe, union_probe_lists } from "./compose-probe-union"
import { normalize_subtitle_style, SubtitleError, srt_to_vtt } from "./compose-subtitles"
import {
    node_output_duration,
    pred_by_handle,
    resolve_trim_range,
    trim_range_error,
    trim_upstream_duration,
} from "./compose-trim"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { ClipError, extract_clip, type ProbeResult } from "./mediabunny-clip"
import { collect_stack_segments } from "./mediabunny-compose-stack"
import { render_merge } from "./mediabunny-merge"
import { render_overlay } from "./mediabunny-overlay"
import { render_rescale } from "./mediabunny-rescale"
import { render_solid_color } from "./mediabunny-solid"
import { render_subtitles_burn } from "./mediabunny-subtitles"
import { render_text_overlay } from "./mediabunny-text-overlay"
import { render_transition } from "./mediabunny-transition"
import { resolve_output_video_config } from "./transition-utils"

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
        const style = normalize_subtitle_style(node.data)
        return [node.id, node.type, file_stub_key(node.data.file), JSON.stringify(style)].join(":")
    }
    if (node.type === "overlay") {
        return [
            node.id,
            node.type,
            file_stub_key(node.data.image),
            node.data.position,
            node.data.scale,
            node.data.opacity,
            node.data.offset_x,
            node.data.offset_y,
            node.data.show_start,
            node.data.show_end ?? "null",
        ].join(":")
    }
    if (node.type === "color") {
        return [node.id, node.type, node.data.color, String(node.data.duration)].join(":")
    }
    if (node.type === "text") {
        return [node.id, node.type, JSON.stringify(node.data.items)].join(":")
    }
    if (node.type === "rescale") {
        return [
            node.id,
            node.type,
            String(node.data.width),
            String(node.data.height),
            node.data.fps === null ? "null" : String(node.data.fps),
            node.data.fit,
        ].join(":")
    }
    return [node.id, node.type, JSON.stringify(node.data)].join(":")
}

export function collect_referenced_fonts(relevant: Set<string>, by_id: Map<string, ComposeNode>): string[] {
    const collected = new Set<string>()
    for (const id of relevant) {
        const node = by_id.get(id)
        if (node?.type === "text") {
            for (const item of node.data.items ?? []) {
                const family = item.font.trim().toLowerCase()
                if (family) {
                    collected.add(family)
                }
            }
            continue
        }
        if (node?.type === "subtitles") {
            const family = normalize_subtitle_style(node.data).font_family.trim().toLowerCase()
            if (family) {
                collected.add(family)
            }
        }
    }
    return [...collected].sort()
}

function subgraph_fingerprint(target_id: string, nodes: ComposeNode[], edges: ComposeEdge[]): string {
    const by_id = new Map(nodes.map((node) => [node.id, node]))
    const relevant = new Set([...upstream_of(target_id, nodes, edges), target_id])
    const serial_nodes = [...relevant].sort().map((id) => serialize_node(by_id.get(id) as ComposeNode))
    const serial_edges = edges
        .filter((edge) => relevant.has(edge.source) && relevant.has(edge.target))
        .map((edge) => [edge.id, edge.source, edge.target, edge.targetHandle ?? ""].join(":"))
        .sort()
    const output = find_output_node(nodes)
    const output_settings = output
        ? [
              output.data.width,
              output.data.height,
              output.data.fps,
              output.data.video_bitrate_kbps,
              output.data.audio_quality,
          ].join(":")
        : "no-output"
    return JSON.stringify([
        serial_nodes,
        serial_edges,
        output_settings,
        font_cache_key(collect_referenced_fonts(relevant, by_id)),
    ])
}

export function clear_node_preview_cache(): void {
    preview_memo.clear()
}

function throw_if_aborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
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
    const probe_memo = new Map<string, ProbeResult[]>()
    for (const node_id of order) {
        const probe_node = by_id.get(node_id)
        if (!probe_node) {
            continue
        }
        switch (probe_node.type) {
            case "source": {
                probe_memo.set(node_id, probe_node.data.probe ? [probe_node.data.probe] : [])
                break
            }
            case "color": {
                probe_memo.set(node_id, [])
                break
            }
            case "transition": {
                const { list_a, list_b } = transition_probe_lists(node_id, incoming, probe_memo)
                probe_memo.set(node_id, union_probe_lists([list_a, list_b]))
                break
            }
            case "merge": {
                probe_memo.set(node_id, union_probe_lists(merge_probe_lists(node_id, incoming, probe_memo)))
                break
            }
            default: {
                probe_memo.set(node_id, single_probe_list(node_id, incoming, probe_memo))
                break
            }
        }
    }
    const store = (node_id: string, blob: Blob): void => {
        blobs.set(node_id, blob)
        preview_memo.set(node_id, { upstream: subgraph_fingerprint(node_id, nodes, edges), blob })
    }
    const output_node = find_output_node(nodes)
    const total = Math.max(1, order.length)
    const video_config = output_node ? resolve_output_video_config(output_node.data) : null
    let done = 0
    const fused_dispatch = build_fused_dispatch(collect_stack_segments(nodes, edges), by_id, output_node?.id ?? null)
    const canonical_of = build_fused_canonical(fused_dispatch)
    const remaining = build_downstream_refcounts(edges, relevant, canonical_of)
    const retain = new Set([target_id])
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
        const fused = fused_dispatch.get(node_id) ?? null
        const fused_active = fused !== null && relevant.has(fused.end_id)
        if (fused_active && fused.fused_ids.has(node_id) && node_id !== fused.end_id) {
            continue
        }
        if (fused_active && fused !== null && node_id === fused.end_id) {
            const span_slice = (progress: number) => on_progress?.((done + progress * fused.span) / total)
            const blob = await execute_fused_segment(fused, by_id, incoming, blobs, output_node, span_slice, signal)
            for (const fused_id of fused.fused_ids) {
                store(fused_id, blob)
            }
            // WHY external-input drain: end_id's raw predecessors are internal fused links that canonicalize to self and would delete the fresh blob.
            const fused_inputs = [...fused.fused_ids]
                .flatMap((fused_id) => incoming.get(fused_id) ?? [])
                .filter((edge) => canonical_of(edge.source) !== canonical_of(fused.end_id))
            const fused_incoming = new Map(incoming).set(fused.end_id, fused_inputs)
            drain_consumed_predecessors(fused.end_id, fused_incoming, blobs, remaining, canonical_of, retain)
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
                store(node.id, node.data.file)
                break
            }
            case "trim": {
                const input = single_input(node.id, incoming, blobs)
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
                store(node.id, result.blob)
                break
            }
            case "transition": {
                const { blob_a, blob_b } = transition_inputs(node.id, incoming, blobs)
                const { list_a, list_b } = transition_probe_lists(node.id, incoming, probe_memo)
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
                store(node.id, result.blob)
                break
            }
            case "subtitles": {
                const input = single_input(node.id, incoming, blobs)
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
                store(
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
                break
            }
            case "merge": {
                const merged = merge_inputs(node.id, incoming, blobs)
                const result = await render_merge({
                    files: merged.map((blob, index) => blob_to_file(blob, `merge-in${index}.mp4`)),
                    width: output_node?.data.width ?? 1920,
                    height: output_node?.data.height ?? 1080,
                    fps: output_node?.data.fps ?? 30,
                    quality: "medium",
                    video_bitrate: video_config?.bitrate ?? null,
                    audio_quality: output_node?.data.audio_quality ?? "source-max",
                    audio_probe: peak_audio_probe(probe_memo.get(node.id) ?? []),
                    on_progress: slice,
                    signal,
                })
                store(node.id, result.blob)
                break
            }
            case "overlay": {
                const input = single_input(node.id, incoming, blobs)
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
                store(node.id, result.blob)
                break
            }
            case "text": {
                const input = single_input(node.id, incoming, blobs)
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
                store(node.id, result.blob)
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
                store(node.id, result)
                break
            }
            case "rescale": {
                const input = single_input(node.id, incoming, blobs)
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
                store(node.id, result)
                break
            }
            case "output": {
                const input = single_input(node.id, incoming, blobs)
                store(node.id, await ensure_mp4_blob(input, signal))
                break
            }
        }
        drain_consumed_predecessors(node_id, incoming, blobs, remaining, canonical_of, retain)
        done += 1
        on_progress?.(done / total)
    }
    return blobs.get(target_id) ?? null
}
