import { ClipError, probe_media } from "./mediabunny-clip"
import type { TransitionAudioQuality, TransitionQuality } from "./transition-utils"
import {
    add_canvas_frame,
    CRF_INVALID_MESSAGE,
    draw_contain_fit,
    parse_crf_override,
    with_canvas_encode,
} from "./transition-utils"

export interface RenderRescaleOptions {
    width: number
    height: number
    fps: number | null
    fit: "contain"
    quality?: TransitionQuality
    crf?: number | string | null
    audio_quality?: TransitionAudioQuality
    signal?: AbortSignal
    on_progress?: (done: number, total: number) => void
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported for in-browser rescaling."
const FALLBACK_FPS = 30

function validate_rescale_options(options: RenderRescaleOptions): void {
    const { width, height, fps, fit, quality } = options
    if (!Number.isInteger(width) || width <= 0 || width > 7680 || width % 2 !== 0) {
        throw new ClipError("INVALID_RANGE", "Output width must be a positive even integer up to 7680.")
    }
    if (!Number.isInteger(height) || height <= 0 || height > 7680 || height % 2 !== 0) {
        throw new ClipError("INVALID_RANGE", "Output height must be a positive even integer up to 7680.")
    }
    if (fps !== null && (!Number.isFinite(fps) || fps <= 0)) {
        throw new ClipError("INVALID_RANGE", "Output frame rate must be greater than 0.")
    }
    if (fit !== "contain") {
        throw new ClipError("INVALID_RANGE", "Unknown rescale fit mode.")
    }
    if (quality !== undefined) {
        if (
            quality !== "low" &&
            quality !== "medium" &&
            quality !== "high" &&
            quality !== "very-high" &&
            quality !== "ultra"
        ) {
            throw new ClipError("INVALID_RANGE", "Unknown rescale quality.")
        }
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
            throw new ClipError("INVALID_RANGE", "Unknown rescale audio quality.")
        }
    }
}

export async function render_rescale(input: Blob, options: RenderRescaleOptions): Promise<Blob> {
    const { width, height, signal, on_progress } = options
    const quality: TransitionQuality = options.quality ?? "medium"
    validate_rescale_options({ ...options, quality })
    if (!(input instanceof Blob) || input.size <= 0) {
        throw new ClipError("INVALID_RANGE", "Rescale input must be a non-empty blob.")
    }
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const mb = await import("mediabunny")
    const source = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(input) })
    try {
        if (!(await source.canRead())) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const probe = await probe_media(new File([input], "input", { type: input.type }))
        if (!probe || !probe.has_video || !probe.can_play) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        if (probe.duration === null || !Number.isFinite(probe.duration) || probe.duration <= 0) {
            throw new ClipError("INVALID_RANGE", "Rescale source duration is unknown.")
        }
        const fps =
            options.fps ??
            (typeof probe.frame_rate === "number" && Number.isFinite(probe.frame_rate) && probe.frame_rate > 0
                ? probe.frame_rate
                : FALLBACK_FPS)
        const duration = probe.duration
        const total_frames = Math.max(1, Math.round(duration * fps))
        if (signal?.aborted) {
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        if (!(await mb.canEncodeVideo("avc"))) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const setup = await with_canvas_encode({
            width,
            height,
            fps,
            quality,
            crf_raw: options.crf ?? null,
            audio_probe: probe,
            audio_quality: options.audio_quality ?? "source-max",
            needs_audio: true,
            probe_has_audio: probe.has_audio,
            head_blob_for_audio: input instanceof File ? input : new File([input], "input", { type: input.type }),
            signal,
            body: async (encode_setup, encode_mb) => {
                const { canvas, ctx, video_source, output } = encode_setup
                const video_tracks = await source.getVideoTracks()
                const track = video_tracks[0] ?? null
                if (!track) {
                    throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
                }
                const timestamps: number[] = []
                for (let i = 0; i < total_frames; i += 1) {
                    timestamps.push(i / fps)
                }
                const frame_sink = new encode_mb.CanvasSink(track, { poolSize: 1 })
                const frames = frame_sink.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]()
                for (let i = 0; i < total_frames; i += 1) {
                    if (signal?.aborted) {
                        await output.cancel()
                        throw new ClipError("CANCELLED", "Cancelled.")
                    }
                    const wrapped = (await frames.next()).value
                    ctx.globalAlpha = 1
                    ctx.fillStyle = "#000"
                    ctx.fillRect(0, 0, width, height)
                    if (wrapped?.canvas) {
                        draw_contain_fit(ctx, wrapped.canvas, width, height)
                    }
                    await add_canvas_frame(encode_mb, video_source, canvas, i / fps, 1 / fps)
                    on_progress?.(i + 1, total_frames)
                }
                return encode_setup
            },
        })
        if (!setup.target.buffer) {
            throw new ClipError("FAILED", "Rescale rendering produced no output.")
        }
        return new Blob([setup.target.buffer], { type: setup.output.format.mimeType })
    } finally {
        source.dispose()
    }
}
