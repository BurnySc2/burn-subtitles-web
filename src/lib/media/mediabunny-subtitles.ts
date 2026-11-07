import type { Output } from "mediabunny"
import { CUSTOM_FONT_FAMILY, parse_font_family } from "../utils/custom-font"
import { active_cues_at, parse_srt, resolve_burn_font_px } from "./compose-subtitles"
import type { SubtitleVerticalAnchor } from "./compose-types"
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

export interface BurnSubtitlesOptions {
    srt_content: string
    font_file: File | null
    font_size: number
    text_color: string
    stroke_color: string
    outline_size: number
    shadow_size: number
    horizontal_margin: number
    vertical_anchor: SubtitleVerticalAnchor
    vertical_offset: number
    right_to_left: boolean
    width: number
    height: number
    fps: number
    quality: TransitionQuality
    crf?: number | string | null
    audio_quality?: TransitionAudioQuality
    on_progress?: (progress: number) => void
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported for in-browser subtitle burn-in."

function validate_burn_options(options: BurnSubtitlesOptions): void {
    const { width, height, fps, quality } = options
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
        throw new ClipError("INVALID_RANGE", "Unknown burn quality.")
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
            throw new ClipError("INVALID_RANGE", "Unknown burn audio quality.")
        }
    }
    if (
        options.vertical_anchor !== "top" &&
        options.vertical_anchor !== "center" &&
        options.vertical_anchor !== "bottom"
    ) {
        throw new ClipError("INVALID_RANGE", "Unknown subtitle vertical anchor.")
    }
    if (typeof options.srt_content !== "string" || options.srt_content.trim() === "") {
        throw new ClipError("INVALID_RANGE", "Subtitle content is empty.")
    }
}

function throw_if_cancelled(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
}

function draw_burn_cues(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    opts: BurnSubtitlesOptions,
    font_px: number,
    font_family: string,
): void {
    if (lines.length === 0) {
        return
    }
    const line_height = Math.max(1, Math.round(font_px * 1.2))
    const max_width = Math.max(1, opts.width - opts.horizontal_margin * 2)
    ctx.font = `${font_px}px "${font_family}", sans-serif`
    ctx.direction = opts.right_to_left ? "rtl" : "ltr"
    ctx.textAlign = "center"
    ctx.fillStyle = opts.text_color
    ctx.strokeStyle = opts.stroke_color
    const outline_px = opts.outline_size > 0 ? Math.max(1, (opts.outline_size * font_px) / 24) : 0
    ctx.lineWidth = outline_px
    ctx.lineJoin = "round"
    ctx.shadowColor = outline_px > 0 ? opts.stroke_color : "#000"
    ctx.shadowBlur = opts.shadow_size > 0 ? Math.max(1, (opts.shadow_size * font_px) / 24) : 0
    const pad = Math.max(1, Math.ceil(outline_px) + 1, Math.ceil(ctx.shadowBlur))
    const block_height = lines.length * line_height
    const x = opts.width / 2
    if (opts.vertical_anchor === "top") {
        ctx.textBaseline = "top"
        let y0 = opts.vertical_offset + pad
        y0 = Math.min(y0, Math.max(pad, opts.height - pad - block_height))
        lines.forEach((line, index) => {
            const y = y0 + index * line_height
            if (outline_px > 0) {
                ctx.strokeText(line, x, y, max_width)
            }
            ctx.fillText(line, x, y, max_width)
        })
    } else if (opts.vertical_anchor === "center") {
        ctx.textBaseline = "middle"
        const half_block = block_height / 2
        let y0 = opts.height / 2 + opts.vertical_offset
        y0 = Math.min(Math.max(y0, pad + half_block), Math.max(pad + half_block, opts.height - pad - half_block))
        lines.forEach((line, index) => {
            const y = y0 + (index - (lines.length - 1) / 2) * line_height
            if (outline_px > 0) {
                ctx.strokeText(line, x, y, max_width)
            }
            ctx.fillText(line, x, y, max_width)
        })
    } else {
        ctx.textBaseline = "bottom"
        let y0 = opts.height - opts.vertical_offset - pad
        y0 = Math.max(y0, Math.min(opts.height - pad, pad + block_height))
        lines.forEach((line, index) => {
            const y = y0 - (lines.length - 1 - index) * line_height
            if (outline_px > 0) {
                ctx.strokeText(line, x, y, max_width)
            }
            ctx.fillText(line, x, y, max_width)
        })
    }
    ctx.shadowBlur = 0
}

export async function render_subtitles_burn(
    video: Blob,
    opts: BurnSubtitlesOptions,
    signal?: AbortSignal,
): Promise<Blob> {
    validate_burn_options(opts)
    throw_if_cancelled(signal)
    const mb = await import("mediabunny")
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(video) })
    let output: Output | null = null
    let font_face: FontFace | null = null
    const on_abort = () => {
        void output?.cancel()
    }
    signal?.addEventListener("abort", on_abort, { once: true })
    try {
        if (!(await input.canRead())) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const probe_file = video instanceof File ? video : new File([video], "burn-input.mp4", { type: video.type })
        const probe = await probe_media(probe_file)
        if (!probe || !probe.has_video || !probe.can_play) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        if (probe.duration === null || !Number.isFinite(probe.duration) || probe.duration <= 0) {
            throw new ClipError("INVALID_RANGE", "Burn source duration is unknown.")
        }
        let cues: ReturnType<typeof parse_srt>
        try {
            cues = parse_srt(opts.srt_content)
        } catch (error) {
            throw new ClipError("INVALID_RANGE", (error as Error).message)
        }
        let font_family = "sans-serif"
        if (opts.font_file) {
            const buffer = await opts.font_file.arrayBuffer()
            font_family = parse_font_family(buffer, CUSTOM_FONT_FAMILY)
            try {
                font_face = new FontFace(font_family, buffer)
                document.fonts.add(font_face)
                await font_face.load()
            } catch {
                throw new ClipError("FAILED", "Could not load the custom font.")
            }
        }
        if (cues.length === 0) {
            return video
        }
        throw_if_cancelled(signal)
        await ensure_aac_encoder(mb)
        const target = new mb.BufferTarget()
        output = new mb.Output({ format: new mb.Mp4OutputFormat(), target })
        const { canvas, ctx: encode_ctx } = create_encode_canvas(opts.width, opts.height)
        const video_source = create_encode_video_source(
            mb,
            opts.quality,
            opts.width,
            opts.height,
            opts.fps,
            opts.crf ?? null,
        )
        output.addVideoTrack(video_source)
        const audio_tracks = await input.getAudioTracks()
        const sink = audio_tracks[0] ? new mb.AudioBufferSink(audio_tracks[0]) : null
        const decoded = sink ? await decode_full_audio(sink) : null
        let audio_source: InstanceType<typeof mb.AudioBufferSource> | null = null
        if (probe.has_audio && decoded) {
            audio_source = new mb.AudioBufferSource({
                codec: "aac",
                bitrate: resolve_audio_bitrate(probe, null, opts.audio_quality ?? "source-max"),
            })
            output.addAudioTrack(audio_source)
        }
        await output.start()
        throw_if_cancelled(signal)
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
        const duration = probe.duration
        const total_frames = Math.max(1, Math.round(duration * opts.fps))
        const timestamps: number[] = []
        for (let i = 0; i < total_frames; i += 1) {
            timestamps.push(i / opts.fps)
        }
        const font_px = resolve_burn_font_px(opts.font_size, opts.height)
        const frame_sink = new mb.CanvasSink(track, { poolSize: 1 })
        const frames = frame_sink.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]()
        for (let i = 0; i < total_frames; i += 1) {
            throw_if_cancelled(signal)
            const wrapped = (await frames.next()).value
            const t = i / opts.fps
            ctx.globalAlpha = 1
            ctx.fillStyle = "#000"
            ctx.fillRect(0, 0, opts.width, opts.height)
            if (wrapped?.canvas) {
                draw_contain_fit(ctx, wrapped.canvas, opts.width, opts.height)
            }
            const active = active_cues_at(cues, t)
            const lines: string[] = []
            active.forEach((cue, cue_index) => {
                if (cue_index > 0) {
                    lines.push("")
                }
                for (const line of cue.text.split("\n")) {
                    lines.push(line)
                }
            })
            draw_burn_cues(ctx, lines, opts, font_px, font_family)
            await add_canvas_frame(mb, video_source, canvas, t, 1 / opts.fps)
            opts.on_progress?.(total_frames <= 1 ? 1 : (i + 1) / total_frames)
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
            throw new ClipError("FAILED", "Subtitle burn-in produced no output.")
        }
        return new Blob([target.buffer], { type: output.format.mimeType })
    } finally {
        signal?.removeEventListener("abort", on_abort)
        if (font_face) {
            try {
                document.fonts.delete(font_face)
            } catch {}
        }
        input.dispose()
    }
}
