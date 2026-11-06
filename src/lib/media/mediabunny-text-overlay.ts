import type { Output } from "mediabunny"
import type { OverlayPosition, TextItem } from "./compose-types"
import { ClipError, probe_media } from "./mediabunny-clip"
import type { TransitionAudioQuality, TransitionQuality } from "./transition-utils"
import {
    add_canvas_frame,
    CRF_INVALID_MESSAGE,
    create_encode_canvas,
    create_encode_video_source,
    decode_full_audio,
    draw_contain_fit,
    ensure_aac_encoder,
    parse_crf_override,
    resolve_audio_bitrate,
} from "./transition-utils"

export interface TextAnchorPoint {
    x: number
    y: number
}

export interface RenderTextOverlayOptions {
    video: File
    items: TextItem[]
    width: number
    height: number
    fps: number
    quality: TransitionQuality
    crf?: number | string | null
    audio_quality?: TransitionAudioQuality
    on_progress?: (progress: number) => void
    signal?: AbortSignal
}

export interface RenderTextOverlayResult {
    blob: Blob
    extension: string
    mime: string
    cancel: () => Promise<void>
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported for in-browser text overlay rendering."

const TEXT_POSITIONS: readonly OverlayPosition[] = [
    "top-left",
    "top-center",
    "top-right",
    "center-left",
    "center",
    "center-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
]

export function visible_items(items: TextItem[], t: number): TextItem[] {
    return items.filter((item) => t >= item.show_start && (item.show_end === null || t <= item.show_end))
}

export function item_alpha(item: TextItem, t: number): number {
    if (t < item.show_start || (item.show_end !== null && t > item.show_end)) {
        return 0
    }
    let factor = 1
    if (item.fade_in > 0 && t < item.show_start + item.fade_in) {
        factor = Math.min(factor, (t - item.show_start) / item.fade_in)
    }
    if (item.show_end !== null && item.fade_out > 0 && t > item.show_end - item.fade_out) {
        factor = Math.min(factor, (item.show_end - t) / item.fade_out)
    }
    return Math.min(Math.max(factor, 0), 1) * item.opacity
}

export function resolve_text_anchor(
    anchor: OverlayPosition,
    width: number,
    height: number,
    offset_x: number,
    offset_y: number,
): TextAnchorPoint {
    const parts = anchor === "center" ? ["center", "center"] : anchor.split("-")
    const vertical = parts[0]
    const horizontal = parts.length > 1 ? parts[1] : "center"
    let x: number
    if (horizontal === "left") {
        x = offset_x
    } else if (horizontal === "right") {
        x = width - offset_x
    } else {
        x = width / 2 + offset_x
    }
    let y: number
    if (vertical === "top") {
        y = offset_y
    } else if (vertical === "bottom") {
        y = height - offset_y
    } else {
        y = height / 2 + offset_y
    }
    x = Math.min(Math.max(x, 0), Math.max(width, 0))
    y = Math.min(Math.max(y, 0), Math.max(height, 0))
    return { x, y }
}

export function text_size_at(item: TextItem, t: number, out_h: number): number {
    const scale = out_h / 1080
    if (item.show_end === null || !Number.isFinite(item.show_end) || item.show_end <= item.show_start) {
        return item.size_start * scale
    }
    const u = Math.min(Math.max((t - item.show_start) / (item.show_end - item.show_start), 0), 1)
    return (item.size_start + (item.size_end - item.size_start) * u) * scale
}

function validate_text_item(item: TextItem, index: number): void {
    const prefix = `Text item ${index + 1}`
    if (typeof item.text !== "string" || item.text.length === 0) {
        throw new ClipError("INVALID_RANGE", `${prefix} text must be a non-empty string.`)
    }
    if (typeof item.font !== "string" || item.font.trim() === "") {
        throw new ClipError("INVALID_RANGE", `${prefix} font must be a non-empty string.`)
    }
    if (!Number.isFinite(item.size_start) || item.size_start <= 0) {
        throw new ClipError("INVALID_RANGE", `${prefix} start size must be greater than 0.`)
    }
    if (!Number.isFinite(item.size_end) || item.size_end <= 0) {
        throw new ClipError("INVALID_RANGE", `${prefix} end size must be greater than 0.`)
    }
    if (typeof item.color !== "string" || item.color.trim() === "") {
        throw new ClipError("INVALID_RANGE", `${prefix} color must be a non-empty string.`)
    }
    if (!Number.isFinite(item.opacity) || item.opacity < 0 || item.opacity > 1) {
        throw new ClipError("INVALID_RANGE", `${prefix} opacity must be between 0 and 1.`)
    }
    if (!TEXT_POSITIONS.includes(item.anchor)) {
        throw new ClipError("INVALID_RANGE", `${prefix} has an unknown anchor.`)
    }
    if (!Number.isFinite(item.offset_x) || !Number.isFinite(item.offset_y)) {
        throw new ClipError("INVALID_RANGE", `${prefix} offsets must be finite numbers.`)
    }
    if (item.align !== "left" && item.align !== "center" && item.align !== "right") {
        throw new ClipError("INVALID_RANGE", `${prefix} has an unknown alignment.`)
    }
    if (item.max_width !== null && (!Number.isFinite(item.max_width) || item.max_width <= 0)) {
        throw new ClipError("INVALID_RANGE", `${prefix} max width must be greater than 0 or null.`)
    }
    if (!Number.isFinite(item.show_start) || item.show_start < 0) {
        throw new ClipError("INVALID_RANGE", `${prefix} show start must be at or after 0.`)
    }
    if (item.show_end !== null) {
        if (!Number.isFinite(item.show_end) || item.show_end <= item.show_start) {
            throw new ClipError("INVALID_RANGE", `${prefix} show end must be greater than show start.`)
        }
    }
    if (!Number.isFinite(item.fade_in) || item.fade_in < 0) {
        throw new ClipError("INVALID_RANGE", `${prefix} fade in must be at or after 0.`)
    }
    if (!Number.isFinite(item.fade_out) || item.fade_out < 0) {
        throw new ClipError("INVALID_RANGE", `${prefix} fade out must be at or after 0.`)
    }
    if (item.show_end !== null && item.fade_in + item.fade_out > item.show_end - item.show_start) {
        throw new ClipError("INVALID_RANGE", `${prefix} fade window exceeds show duration.`)
    }
}

export function validate_text_options(options: RenderTextOverlayOptions): void {
    const { video, items, width, height, fps, quality } = options
    if (!(video instanceof File)) {
        throw new ClipError("INVALID_RANGE", "Text overlay video input must be a file.")
    }
    if (!Array.isArray(items) || items.length === 0) {
        throw new ClipError("INVALID_RANGE", "Text overlay needs at least one text item.")
    }
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        throw new ClipError("INVALID_RANGE", "Output width and height must be positive integers.")
    }
    if (!Number.isFinite(fps) || fps <= 0) {
        throw new ClipError("INVALID_RANGE", "Output frame rate must be greater than 0.")
    }
    if (
        quality !== "low" &&
        quality !== "medium" &&
        quality !== "high" &&
        quality !== "very-high" &&
        quality !== "ultra"
    ) {
        throw new ClipError("INVALID_RANGE", "Unknown text overlay quality.")
    }
    try {
        parse_crf_override(options.crf ?? null)
    } catch {
        throw new ClipError("INVALID_RANGE", CRF_INVALID_MESSAGE)
    }
    if (options.audio_quality !== undefined) {
        if (
            options.audio_quality !== "96k" &&
            options.audio_quality !== "128k" &&
            options.audio_quality !== "192k" &&
            options.audio_quality !== "256k" &&
            options.audio_quality !== "320k" &&
            options.audio_quality !== "source-max"
        ) {
            throw new ClipError("INVALID_RANGE", "Unknown text overlay audio quality.")
        }
    }
    for (const [index, item] of items.entries()) {
        validate_text_item(item, index)
    }
}

export async function render_text_overlay(options: RenderTextOverlayOptions): Promise<RenderTextOverlayResult> {
    const { video, items, width, height, fps, quality, on_progress, signal } = options
    validate_text_options(options)
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const mb = await import("mediabunny")
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(video) })
    let output: Output | null = null
    const on_abort = () => {
        void output?.cancel()
    }
    signal?.addEventListener("abort", on_abort, { once: true })
    try {
        if (!(await input.canRead())) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const probe = await probe_media(video)
        if (!probe || !probe.has_video || !probe.can_play) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        if (probe.duration === null || !Number.isFinite(probe.duration) || probe.duration <= 0) {
            throw new ClipError("INVALID_RANGE", "Text overlay source duration is unknown.")
        }
        const duration = probe.duration
        const total_frames = Math.max(1, Math.round(duration * fps))
        if (signal?.aborted) {
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        await ensure_aac_encoder(mb)
        const target = new mb.BufferTarget()
        output = new mb.Output({ format: new mb.Mp4OutputFormat(), target })
        const { canvas, ctx: encode_ctx } = create_encode_canvas(width, height)
        const video_source = create_encode_video_source(mb, quality, width, height, fps, options.crf ?? null)
        output.addVideoTrack(video_source)
        const audio_tracks = await input.getAudioTracks()
        const sink = audio_tracks[0] ? new mb.AudioBufferSink(audio_tracks[0]) : null
        const decoded = sink ? await decode_full_audio(sink) : null
        let audio_source: InstanceType<typeof mb.AudioBufferSource> | null = null
        if (probe.has_audio && decoded) {
            audio_source = new mb.AudioBufferSource({
                codec: "aac",
                bitrate: resolve_audio_bitrate(probe, null, options.audio_quality ?? "source-max"),
            })
            output.addAudioTrack(audio_source)
        }
        await output.start()
        if (signal?.aborted) {
            await output.cancel()
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        if (audio_source && decoded) {
            await audio_source.add(decoded)
        }
        const ctx = encode_ctx
        if (!ctx) {
            throw new ClipError("FAILED", "Could not acquire a 2D canvas context.")
        }
        const video_tracks = await input.getVideoTracks()
        const track = video_tracks[0] ?? null
        if (!track) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const timestamps: number[] = []
        for (let i = 0; i < total_frames; i += 1) {
            timestamps.push(i / fps)
        }
        const scale = height / 1080
        const frame_sink = new mb.CanvasSink(track, { poolSize: 1 })
        const frames = frame_sink.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]()
        for (let i = 0; i < total_frames; i += 1) {
            if (signal?.aborted) {
                await output.cancel()
                throw new ClipError("CANCELLED", "Cancelled.")
            }
            const wrapped = (await frames.next()).value
            const t = i / fps
            ctx.globalAlpha = 1
            ctx.fillStyle = "#000"
            ctx.fillRect(0, 0, width, height)
            if (wrapped?.canvas) {
                draw_contain_fit(ctx, wrapped.canvas, width, height)
            }
            for (const item of visible_items(items, t)) {
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
                    item.offset_x * scale,
                    item.offset_y * scale,
                )
                ctx.globalAlpha = alpha
                ctx.font = `${size.toFixed(2)}px ${item.font}`
                ctx.textAlign = item.align
                ctx.textBaseline = "middle"
                ctx.fillStyle = item.color
                if (item.max_width !== null) {
                    ctx.fillText(item.text, point.x, point.y, item.max_width * scale)
                } else {
                    ctx.fillText(item.text, point.x, point.y)
                }
            }
            ctx.globalAlpha = 1
            await add_canvas_frame(mb, video_source, canvas, t, 1 / fps)
            on_progress?.(total_frames <= 1 ? 1 : (i + 1) / total_frames)
        }
        try {
            await output.finalize()
        } catch (error) {
            if (
                output.state === "canceled" ||
                error instanceof mb.ConversionCanceledError ||
                (error instanceof Error && error.name === "ConversionCanceledError")
            ) {
                throw new ClipError("CANCELLED", "Cancelled.")
            }
            throw error
        }
        if (!target.buffer) {
            throw new ClipError("FAILED", "Text overlay rendering produced no output.")
        }
        const done = output
        const blob = new Blob([target.buffer], { type: output.format.mimeType })
        return {
            blob,
            extension: output.format.fileExtension,
            mime: output.format.mimeType,
            cancel: () => done.cancel(),
        }
    } finally {
        signal?.removeEventListener("abort", on_abort)
        input.dispose()
    }
}
