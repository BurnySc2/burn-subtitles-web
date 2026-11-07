import { ClipError } from "./mediabunny-clip"
import type { TransitionQuality } from "./transition-utils"
import { add_canvas_frame, CRF_INVALID_MESSAGE, parse_crf_override, with_canvas_encode } from "./transition-utils"

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
        throw new ClipError("INVALID_RANGE", CRF_INVALID_MESSAGE)
    }
}

export async function render_solid_color(options: RenderSolidOptions): Promise<Blob> {
    const { color, duration, width, height, fps, signal, on_progress } = options
    const quality: TransitionQuality = options.quality ?? "medium"
    validate_solid_options({ ...options, quality })
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const gate = await import("mediabunny")
    if (!(await gate.canEncodeVideo("avc"))) {
        throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
    }
    const total_frames = Math.max(1, Math.round(duration * fps))
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const setup = await with_canvas_encode({
        width,
        height,
        fps,
        quality,
        crf_raw: options.crf ?? null,
        audio_probe: null,
        audio_quality: "source-max",
        needs_audio: false,
        probe_has_audio: false,
        head_blob_for_audio: null,
        signal,
        body: async (encode_setup, mb) => {
            const { canvas, ctx, video_source, output } = encode_setup
            for (let i = 0; i < total_frames; i += 1) {
                if (signal?.aborted) {
                    await output.cancel()
                    throw new ClipError("CANCELLED", "Cancelled.")
                }
                ctx.globalAlpha = 1
                ctx.fillStyle = color
                ctx.fillRect(0, 0, width, height)
                await add_canvas_frame(mb, video_source, canvas, i / fps, 1 / fps)
                on_progress?.(i + 1, total_frames)
            }
            return encode_setup
        },
    })
    if (!setup.target.buffer) {
        throw new ClipError("FAILED", "Solid rendering produced no output.")
    }
    return new Blob([setup.target.buffer], { type: setup.output.format.mimeType })
}
