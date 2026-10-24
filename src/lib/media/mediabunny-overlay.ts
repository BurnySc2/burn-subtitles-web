import type { Output } from "mediabunny"
import type { OverlayPosition } from "./compose-types"
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

export interface ImageProbe {
    width: number
    height: number
    mime: string
    size: number
}

export async function probe_image(file: File): Promise<ImageProbe> {
    let bitmap: ImageBitmap | null = null
    try {
        bitmap = await createImageBitmap(file)
        return { width: bitmap.width, height: bitmap.height, mime: file.type, size: file.size }
    } finally {
        bitmap?.close()
    }
}

export interface OverlayRect {
    dx: number
    dy: number
    dw: number
    dh: number
}

export function resolve_overlay_rect(opts: {
    bg_width: number
    bg_height: number
    img_width: number
    img_height: number
    position: OverlayPosition
    scale: number
    offset_x: number
    offset_y: number
}): OverlayRect {
    const { bg_width, bg_height, img_width, img_height, position, scale, offset_x, offset_y } = opts
    const dw = (bg_width * scale) / 100
    const dh = img_width > 0 ? (dw * img_height) / img_width : 0
    const parts = position === "center" ? ["center", "center"] : position.split("-")
    const vertical = parts[0]
    const horizontal = parts.length > 1 ? parts[1] : "center"
    let dx: number
    if (horizontal === "left") {
        dx = offset_x
    } else if (horizontal === "right") {
        dx = bg_width - dw - offset_x
    } else {
        dx = (bg_width - dw) / 2 + offset_x
    }
    let dy: number
    if (vertical === "top") {
        dy = offset_y
    } else if (vertical === "bottom") {
        dy = bg_height - dh - offset_y
    } else {
        dy = (bg_height - dh) / 2 + offset_y
    }
    dx = Math.min(Math.max(dx, 0), Math.max(bg_width - dw, 0))
    dy = Math.min(Math.max(dy, 0), Math.max(bg_height - dh, 0))
    return { dx, dy, dw, dh }
}

export interface RenderOverlayOptions {
    video: File
    image: File
    position: OverlayPosition
    scale: number
    opacity: number
    offset_x: number
    offset_y: number
    show_start: number
    show_end: number | null
    width: number
    height: number
    fps: number
    quality: TransitionQuality
    crf?: number | string | null
    audio_quality?: TransitionAudioQuality
    on_progress?: (progress: number) => void
    signal?: AbortSignal
}

export interface RenderOverlayResult {
    blob: Blob
    extension: string
    mime: string
    cancel: () => Promise<void>
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported for in-browser overlay rendering."

function validate_overlay_options(options: RenderOverlayOptions): void {
    const { video, image, width, height, fps, quality } = options
    if (!(video instanceof File)) {
        throw new ClipError("INVALID_RANGE", "Overlay video input must be a file.")
    }
    if (!(image instanceof File)) {
        throw new ClipError("INVALID_RANGE", "Overlay image input must be a file.")
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
        throw new ClipError("INVALID_RANGE", "Unknown overlay quality.")
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
            throw new ClipError("INVALID_RANGE", "Unknown overlay audio quality.")
        }
    }
    if (
        options.position !== "top-left" &&
        options.position !== "top-center" &&
        options.position !== "top-right" &&
        options.position !== "center-left" &&
        options.position !== "center" &&
        options.position !== "center-right" &&
        options.position !== "bottom-left" &&
        options.position !== "bottom-center" &&
        options.position !== "bottom-right"
    ) {
        throw new ClipError("INVALID_RANGE", "Unknown overlay position.")
    }
    if (!Number.isFinite(options.scale) || options.scale <= 0) {
        throw new ClipError("INVALID_RANGE", "Overlay scale must be greater than 0.")
    }
    if (!Number.isFinite(options.opacity) || options.opacity < 0 || options.opacity > 1) {
        throw new ClipError("INVALID_RANGE", "Overlay opacity must be between 0 and 1.")
    }
    if (!Number.isFinite(options.offset_x) || !Number.isFinite(options.offset_y)) {
        throw new ClipError("INVALID_RANGE", "Overlay offsets must be finite numbers.")
    }
    if (!Number.isFinite(options.show_start) || options.show_start < 0) {
        throw new ClipError("INVALID_RANGE", "Overlay show start must be at or after 0.")
    }
    if (options.show_end !== null && options.show_end !== undefined) {
        if (!Number.isFinite(options.show_end) || options.show_end <= options.show_start) {
            throw new ClipError("INVALID_RANGE", "Overlay show end must be greater than show start.")
        }
    }
}

export async function render_overlay(options: RenderOverlayOptions): Promise<RenderOverlayResult> {
    const { video, image, width, height, fps, quality, on_progress, signal } = options
    validate_overlay_options(options)
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const mb = await import("mediabunny")
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(video) })
    let output: Output | null = null
    let bitmap: ImageBitmap | null = null
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
            throw new ClipError("INVALID_RANGE", "Overlay source duration is unknown.")
        }
        bitmap = await createImageBitmap(image)
        if (bitmap.width <= 0 || bitmap.height <= 0) {
            throw new ClipError("INVALID_RANGE", "Overlay image has no decodable pixels.")
        }
        const rect = resolve_overlay_rect({
            bg_width: width,
            bg_height: height,
            img_width: bitmap.width,
            img_height: bitmap.height,
            position: options.position,
            scale: options.scale,
            offset_x: options.offset_x,
            offset_y: options.offset_y,
        })
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
        const frame_sink = new mb.CanvasSink(track, { poolSize: 1 })
        const frames = frame_sink.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]()
        const show_end = options.show_end ?? null
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
            if (t >= options.show_start && (show_end === null || t <= show_end)) {
                ctx.globalAlpha = options.opacity
                ctx.drawImage(bitmap, rect.dx, rect.dy, rect.dw, rect.dh)
                ctx.globalAlpha = 1
            }
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
            throw new ClipError("FAILED", "Overlay rendering produced no output.")
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
        bitmap?.close()
        input.dispose()
    }
}
