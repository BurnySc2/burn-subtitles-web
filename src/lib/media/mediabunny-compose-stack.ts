import type { ComposeEdge, ComposeNode, OverlayNodeData, RescaleNodeData, TextItem } from "./compose-types"
import { ClipError, type ProbeResult, probe_media } from "./mediabunny-clip"
import { type OverlayRect, resolve_overlay_rect } from "./mediabunny-overlay"
import {
    type AnimatedTextBitmap,
    animated_text_key,
    is_animated_text,
    item_alpha,
    measure_text_width,
    rasterize_animated_text,
    resolve_text_anchor,
    text_size_at,
} from "./mediabunny-text-overlay"
import type { TransitionAudioQuality, TransitionQuality } from "./transition-utils"
import {
    add_canvas_frame,
    CRF_INVALID_MESSAGE,
    draw_contain_fit,
    parse_crf_override,
    with_canvas_encode,
} from "./transition-utils"

export type StackHead = { kind: "blob"; file: File | null } | { kind: "solid"; color: string; duration: number }

export interface StackOverlayLayer {
    kind: "overlay"
    node_id: string
    data: OverlayNodeData
    image: File | null
}

export interface StackTextLayer {
    kind: "text"
    node_id: string
    items: TextItem[]
}

export type StackLayer = StackOverlayLayer | StackTextLayer

export interface StackTarget {
    width: number
    height: number
    fps: number
    quality: TransitionQuality
    crf: number | string | null
    audio_quality: TransitionAudioQuality
}

export interface RenderStackOptions {
    head: StackHead
    layers: StackLayer[]
    target: StackTarget
    /** Target already folds terminal rescale dims; only contain fit is supported. */
    terminal_rescale: RescaleNodeData | null
    signal?: AbortSignal
    on_progress?: (progress: number) => void
}

export interface RenderStackResult {
    blob: Blob
    extension: string
    mime: string
    cancel: () => Promise<void>
}

export interface StackSegment {
    head_id: string | null
    node_ids: string[]
    terminal_rescale_id: string | null
    fast_path: boolean
}

export function stack_windows_closed(layers: StackLayer[], duration: number): boolean {
    if (layers.length === 0) {
        return true
    }
    return layers.every((layer) => {
        if (layer.kind === "overlay") {
            const show_end = layer.data.show_end ?? null
            if (show_end === null) {
                return false
            }
            return show_end <= 0 || layer.data.show_start >= duration
        }
        if (layer.items.length === 0) {
            return true
        }
        return layer.items.every(
            (item) => item.show_start >= duration || (item.show_end !== null && item.show_end <= 0),
        )
    })
}

function sole_predecessor(
    node_id: string,
    by_id: Map<string, ComposeNode>,
    incoming: Map<string, ComposeEdge[]>,
    seen: Set<string>,
): ComposeNode | null {
    const edges = incoming.get(node_id) ?? []
    if (edges.length !== 1) {
        return null
    }
    const next = by_id.get(edges[0].source) ?? null
    if (!next || seen.has(next.id)) {
        return null
    }
    return next
}

export function collect_stack_segments(nodes: ComposeNode[], edges: ComposeEdge[]): StackSegment[] {
    const by_id = new Map(nodes.map((node) => [node.id, node]))
    const incoming = new Map<string, ComposeEdge[]>()
    for (const node of nodes) {
        incoming.set(node.id, [])
    }
    for (const edge of edges) {
        if (incoming.has(edge.target)) {
            incoming.get(edge.target)?.push(edge)
        }
    }
    const output = nodes.find((node) => node.type === "output") ?? null
    if (!output) {
        return []
    }
    const chain: ComposeNode[] = [output]
    const seen = new Set<string>([output.id])
    let terminal_rescale_id: string | null = null
    let head_id: string | null = null
    let current: ComposeNode = output
    while (true) {
        const next = sole_predecessor(current.id, by_id, incoming, seen)
        if (!next) {
            break
        }
        seen.add(next.id)
        if (next.type === "overlay" || next.type === "text") {
            chain.unshift(next)
            current = next
            continue
        }
        if (next.type === "subtitles") {
            break
        }
        if (next.type === "rescale") {
            if (terminal_rescale_id !== null) {
                break
            }
            terminal_rescale_id = next.id
            chain.unshift(next)
            current = next
            continue
        }
        if (next.type === "source" || next.type === "color") {
            if ((incoming.get(next.id) ?? []).length > 0) {
                break
            }
            chain.unshift(next)
            head_id = next.id
            break
        }
        break
    }
    const layers: StackLayer[] = []
    for (const node of chain) {
        if (node.type === "overlay") {
            layers.push({ kind: "overlay", node_id: node.id, data: node.data, image: node.data.image })
        } else if (node.type === "text") {
            layers.push({ kind: "text", node_id: node.id, items: node.data.items })
        }
    }
    const head_node = head_id ? (by_id.get(head_id) ?? null) : null
    let duration: number | null = null
    if (head_node?.type === "color") {
        duration = head_node.data.duration
    } else if (head_node?.type === "source") {
        duration = head_node.data.probe?.duration ?? null
    }
    const fast_path = duration === null ? layers.length === 0 : stack_windows_closed(layers, duration)
    return [{ head_id, node_ids: chain.map((node) => node.id), terminal_rescale_id, fast_path }]
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported for in-browser stack rendering."

function wrap_stack_lines(text: string, font: string, max_width: number): string[] {
    const paragraphs = text.split("\n")
    const lines: string[] = []
    for (const paragraph of paragraphs) {
        const words = paragraph.split(/\s+/).filter((word) => word !== "")
        if (words.length === 0) {
            lines.push("")
            continue
        }
        let current = words[0]
        for (let i = 1; i < words.length; i += 1) {
            const candidate = `${current} ${words[i]}`
            const measured = measure_text_width(candidate, font)
            if (measured === null) {
                return [text]
            }
            if (measured <= max_width) {
                current = candidate
            } else {
                lines.push(current)
                current = words[i]
            }
        }
        lines.push(current)
    }
    return lines.length > 0 ? lines : [text]
}

function validate_stack_options(options: RenderStackOptions): void {
    const { target, head } = options
    if (options.terminal_rescale && options.terminal_rescale.fit !== "contain") {
        throw new ClipError("INVALID_RANGE", "Stack rescale fit must be contain.")
    }
    if (
        !Number.isInteger(target.width) ||
        target.width <= 0 ||
        !Number.isInteger(target.height) ||
        target.height <= 0
    ) {
        throw new ClipError("INVALID_RANGE", "Output width and height must be positive integers.")
    }
    if (!Number.isFinite(target.fps) || target.fps <= 0) {
        throw new ClipError("INVALID_RANGE", "Output frame rate must be greater than 0.")
    }
    if (
        target.quality !== "low" &&
        target.quality !== "medium" &&
        target.quality !== "high" &&
        target.quality !== "very-high" &&
        target.quality !== "ultra"
    ) {
        throw new ClipError("INVALID_RANGE", "Unknown stack quality.")
    }
    try {
        parse_crf_override(target.crf ?? null)
    } catch {
        throw new ClipError("INVALID_RANGE", CRF_INVALID_MESSAGE)
    }
    if (
        target.audio_quality !== "96k" &&
        target.audio_quality !== "128k" &&
        target.audio_quality !== "192k" &&
        target.audio_quality !== "256k" &&
        target.audio_quality !== "320k" &&
        target.audio_quality !== "source-max"
    ) {
        throw new ClipError("INVALID_RANGE", "Unknown stack audio quality.")
    }
    if (head.kind === "blob") {
        if (!(head.file instanceof File)) {
            throw new ClipError("INVALID_RANGE", "Stack video input must be a file.")
        }
    } else if (!/^#[0-9a-fA-F]{6}$/.test(head.color)) {
        throw new ClipError("INVALID_RANGE", "Stack color must be a hex string like #000000.")
    } else if (!Number.isFinite(head.duration) || head.duration <= 0 || head.duration > 3600) {
        throw new ClipError("INVALID_RANGE", "Stack duration must be greater than 0 and at most 3600.")
    }
}

interface ResolvedOverlay {
    layer: StackOverlayLayer
    bitmap: ImageBitmap | null
    rect: OverlayRect | null
}

export async function render_compose_stack(options: RenderStackOptions): Promise<RenderStackResult> {
    const { head, layers, target, signal, on_progress } = options
    const { width, height, fps, quality } = target
    validate_stack_options(options)
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const mb = await import("mediabunny")
    const head_file = head.kind === "blob" ? head.file : null
    const solid_color = head.kind === "solid" ? head.color : null
    const input = head_file ? new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(head_file) }) : null
    const bitmaps: ImageBitmap[] = []
    try {
        let probe: ProbeResult | null = null
        let duration: number | null = head.kind === "solid" ? head.duration : null
        if (head_file && input) {
            if (!(await input.canRead())) {
                throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
            }
            probe = await probe_media(head_file)
            if (!probe || !probe.has_video || !probe.can_play) {
                throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
            }
            if (probe.duration === null || !Number.isFinite(probe.duration) || probe.duration <= 0) {
                throw new ClipError("INVALID_RANGE", "Stack source duration is unknown.")
            }
            duration = probe.duration
        }
        if (duration === null || !Number.isFinite(duration) || duration <= 0) {
            throw new ClipError("INVALID_RANGE", "Stack source duration is unknown.")
        }
        const total_frames = Math.max(1, Math.round(duration * fps))
        if (signal?.aborted) {
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        const flat_items: { item: TextItem; key: string }[] = []
        {
            let index = 0
            for (const layer of layers) {
                if (layer.kind !== "text") {
                    continue
                }
                for (const item of layer.items) {
                    flat_items.push({ item, key: animated_text_key(index, item) })
                    index += 1
                }
            }
        }
        const setup = await with_canvas_encode({
            width,
            height,
            fps,
            quality,
            crf_raw: target.crf ?? null,
            audio_probe: probe,
            audio_quality: target.audio_quality,
            needs_audio: head_file !== null,
            probe_has_audio: probe?.has_audio ?? false,
            head_blob_for_audio: head_file,
            signal,
            body: async (encode_setup, encode_mb) => {
                const { canvas, ctx, video_source, output } = encode_setup
                const mb = encode_mb
                try {
                    const resolved: ResolvedOverlay[] = []
                    for (const layer of layers) {
                        if (layer.kind !== "overlay") {
                            continue
                        }
                        let bitmap: ImageBitmap | null = null
                        let rect: OverlayRect | null = null
                        if (layer.image instanceof File) {
                            bitmap = await createImageBitmap(layer.image)
                            bitmaps.push(bitmap)
                            if (bitmap.width <= 0 || bitmap.height <= 0) {
                                throw new ClipError("INVALID_RANGE", "Overlay image has no decodable pixels.")
                            }
                            rect = resolve_overlay_rect({
                                bg_width: width,
                                bg_height: height,
                                img_width: bitmap.width,
                                img_height: bitmap.height,
                                position: layer.data.position,
                                scale: layer.data.scale,
                                offset_x: layer.data.offset_x,
                                offset_y: layer.data.offset_y,
                            })
                        }
                        resolved.push({ layer, bitmap, rect })
                    }
                    const timestamps: number[] = []
                    for (let i = 0; i < total_frames; i += 1) {
                        timestamps.push(i / fps)
                    }
                    const text_scale = height / 1080
                    const animated_cache = new Map<string, AnimatedTextBitmap>()
                    for (const { item, key } of flat_items) {
                        if (!is_animated_text(item) || item.show_end === null) {
                            continue
                        }
                        const cached_size = Math.max(item.size_start, item.size_end) * text_scale
                        if (!Number.isFinite(cached_size) || cached_size <= 0) {
                            continue
                        }
                        const entry = rasterize_animated_text(item, cached_size, text_scale)
                        if (entry) {
                            animated_cache.set(key, entry)
                        }
                    }
                    const windows_closed = stack_windows_closed(layers, duration)
                    const dims_match = probe?.display_width === width && probe?.display_height === height
                    const forward_samples = head_file !== null && input !== null && dims_match && windows_closed
                    if (forward_samples && input) {
                        const video_tracks = await input.getVideoTracks()
                        const track = video_tracks[0] ?? null
                        if (!track) {
                            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
                        }
                        const sample_sink = new mb.VideoSampleSink(track)
                        const samples = sample_sink.samplesAtTimestamps(timestamps)[Symbol.asyncIterator]()
                        for (let i = 0; i < total_frames; i += 1) {
                            if (signal?.aborted) {
                                await output.cancel()
                                throw new ClipError("CANCELLED", "Cancelled.")
                            }
                            const sample = (await samples.next()).value
                            const output_t = i / fps
                            if (sample) {
                                try {
                                    sample.setTimestamp(output_t)
                                    sample.setDuration(1 / fps)
                                    await video_source.add(sample)
                                } finally {
                                    sample.close()
                                }
                            } else {
                                ctx.globalAlpha = 1
                                ctx.fillStyle = "#000"
                                ctx.fillRect(0, 0, width, height)
                                await add_canvas_frame(mb, video_source, canvas, output_t, 1 / fps)
                            }
                            on_progress?.(total_frames <= 1 ? 1 : (i + 1) / total_frames)
                        }
                    } else {
                        const video_tracks = input ? await input.getVideoTracks() : []
                        const track = video_tracks[0] ?? null
                        if (input && !track) {
                            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
                        }
                        const frame_sink = track ? new mb.CanvasSink(track, { poolSize: 1 }) : null
                        const frames = frame_sink
                            ? frame_sink.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]()
                            : null
                        for (let i = 0; i < total_frames; i += 1) {
                            if (signal?.aborted) {
                                await output.cancel()
                                throw new ClipError("CANCELLED", "Cancelled.")
                            }
                            const wrapped = frames ? (await frames.next()).value : null
                            const t = i / fps
                            ctx.globalAlpha = 1
                            ctx.fillStyle = solid_color ?? "#000"
                            ctx.fillRect(0, 0, width, height)
                            if (wrapped?.canvas) {
                                draw_contain_fit(ctx, wrapped.canvas, width, height)
                            }
                            for (const entry of resolved) {
                                if (!entry.bitmap || !entry.rect) {
                                    continue
                                }
                                const show_end = entry.layer.data.show_end ?? null
                                if (t >= entry.layer.data.show_start && (show_end === null || t <= show_end)) {
                                    ctx.globalAlpha = entry.layer.data.opacity
                                    ctx.drawImage(
                                        entry.bitmap,
                                        entry.rect.dx,
                                        entry.rect.dy,
                                        entry.rect.dw,
                                        entry.rect.dh,
                                    )
                                    ctx.globalAlpha = 1
                                }
                            }
                            let key_index = 0
                            for (const layer of layers) {
                                if (layer.kind !== "text") {
                                    continue
                                }
                                for (const item of layer.items) {
                                    const key = flat_items[key_index]?.key ?? ""
                                    key_index += 1
                                    if (t < item.show_start || (item.show_end !== null && t > item.show_end)) {
                                        continue
                                    }
                                    const alpha = item_alpha(item, t)
                                    if (alpha <= 0) {
                                        continue
                                    }
                                    const size = text_size_at(item, t, height)
                                    if (!Number.isFinite(size) || size <= 0) {
                                        continue
                                    }
                                    const point = resolve_text_anchor(
                                        item.anchor,
                                        width,
                                        height,
                                        item.offset_x * text_scale,
                                        item.offset_y * text_scale,
                                    )
                                    const cached = item.show_end === null ? undefined : animated_cache.get(key)
                                    if (cached) {
                                        const factor = size / cached.cached_size
                                        if (Number.isFinite(factor) && factor > 0) {
                                            ctx.save()
                                            ctx.globalAlpha = alpha
                                            ctx.translate(point.x, point.y)
                                            ctx.scale(factor, factor)
                                            ctx.drawImage(cached.canvas, cached.dx, cached.dy)
                                            ctx.restore()
                                            continue
                                        }
                                    }
                                    ctx.globalAlpha = alpha
                                    const font_str = `${size}px ${item.font}`
                                    ctx.font = font_str
                                    ctx.textAlign = item.align
                                    ctx.textBaseline = "middle"
                                    ctx.fillStyle = item.color
                                    const max_w = item.max_width !== null ? item.max_width * text_scale : null
                                    const lines =
                                        max_w !== null ? wrap_stack_lines(item.text, font_str, max_w) : [item.text]
                                    const line_h = 1.2 * size
                                    const start_y = point.y - ((lines.length - 1) * line_h) / 2
                                    for (let line_index = 0; line_index < lines.length; line_index += 1) {
                                        ctx.fillText(lines[line_index], point.x, start_y + line_index * line_h)
                                    }
                                }
                            }
                            ctx.globalAlpha = 1
                            await add_canvas_frame(mb, video_source, canvas, t, 1 / fps)
                            on_progress?.(total_frames <= 1 ? 1 : (i + 1) / total_frames)
                        }
                    }
                    return encode_setup
                } catch (error) {
                    for (const bitmap of bitmaps) {
                        bitmap.close()
                    }
                    bitmaps.length = 0
                    throw error
                }
            },
        })
        if (!setup.target.buffer) {
            throw new ClipError("FAILED", "Stack rendering produced no output.")
        }
        const done = setup.output
        const blob = new Blob([setup.target.buffer], { type: setup.output.format.mimeType })
        return {
            blob,
            extension: setup.output.format.fileExtension,
            mime: setup.output.format.mimeType,
            cancel: () => done.cancel(),
        }
    } finally {
        for (const bitmap of bitmaps) {
            try {
                bitmap.close()
            } catch {
                // Bitmap may already be closed on the error path.
            }
        }
        input?.dispose()
    }
}
