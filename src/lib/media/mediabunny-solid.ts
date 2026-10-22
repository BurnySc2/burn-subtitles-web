import type { Output } from "mediabunny"
import { ClipError } from "./mediabunny-clip"
import type { TransitionQuality } from "./transition-utils"
import { parse_crf_override, quality_to_video_config } from "./transition-utils"

export interface RenderSolidOptions {
    color: string
    duration: number
    width: number
    height: number
    fps: number
    quality?: TransitionQuality
    crf?: number | string | null
    signal?: AbortSignal
    on_progress?: (done: number, total: number) => void
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported for in-browser solid rendering."

function validate_solid_options(options: RenderSolidOptions): void {
    const { color, duration, width, height, fps, quality } = options
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        throw new ClipError("INVALID_RANGE", "Solid color must be a hex string like #000000.")
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration > 3600) {
        throw new ClipError("INVALID_RANGE", "Solid duration must be greater than 0 and at most 3600.")
    }
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        throw new ClipError("INVALID_RANGE", "Output width and height must be positive integers.")
    }
    if (!Number.isFinite(fps) || fps <= 0) {
        throw new ClipError("INVALID_RANGE", "Output frame rate must be greater than 0.")
    }
    if (quality !== undefined) {
        if (
            quality !== "low" &&
            quality !== "medium" &&
            quality !== "high" &&
            quality !== "very-high" &&
            quality !== "ultra"
        ) {
            throw new ClipError("INVALID_RANGE", "Unknown solid quality.")
        }
    }
    try {
        parse_crf_override(options.crf ?? null)
    } catch {
        throw new ClipError("INVALID_RANGE", "CRF override must be a number from 0 to 51.")
    }
}

export async function render_solid_color(options: RenderSolidOptions): Promise<Blob> {
    const { color, duration, width, height, fps, signal, on_progress } = options
    const quality: TransitionQuality = options.quality ?? "medium"
    validate_solid_options({ ...options, quality })
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const mb = await import("mediabunny")
    let output: Output | null = null
    const on_abort = () => {
        void output?.cancel()
    }
    signal?.addEventListener("abort", on_abort, { once: true })
    try {
        if (!(await mb.canEncodeVideo("avc"))) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const total_frames = Math.max(1, Math.round(duration * fps))
        if (signal?.aborted) {
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        const target = new mb.BufferTarget()
        output = new mb.Output({ format: new mb.Mp4OutputFormat(), target })
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const crf = parse_crf_override(options.crf ?? null)
        const video_config = quality_to_video_config(quality, width, height, fps, crf)
        const video_quality =
            video_config.quantizer !== null
                ? new mb.Quality({
                      quantizer: video_config.quantizer,
                      bitrate: video_config.bitrate,
                      bitrateMode: "variable",
                  })
                : new mb.Quality({ bitrate: video_config.bitrate, bitrateMode: "variable" })
        const video_source = new mb.CanvasSource(canvas, {
            codec: "avc",
            quality: video_quality,
            latencyMode: "quality",
            hardwareAcceleration: "no-preference",
            bitrateMode: "variable",
        })
        output.addVideoTrack(video_source)
        await output.start()
        if (signal?.aborted) {
            await output.cancel()
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            throw new ClipError("FAILED", "Could not acquire a 2D canvas context.")
        }
        for (let i = 0; i < total_frames; i += 1) {
            if (signal?.aborted) {
                await output.cancel()
                throw new ClipError("CANCELLED", "Cancelled.")
            }
            ctx.globalAlpha = 1
            ctx.fillStyle = color
            ctx.fillRect(0, 0, width, height)
            await video_source.add(i / fps, 1 / fps)
            on_progress?.(i + 1, total_frames)
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
            throw new ClipError("FAILED", "Solid rendering produced no output.")
        }
        return new Blob([target.buffer], { type: output.format.mimeType })
    } finally {
        signal?.removeEventListener("abort", on_abort)
    }
}
