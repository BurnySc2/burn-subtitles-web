import type { Output } from "mediabunny"
import { concat_audio_buffers } from "./compose-audio"
import type { ProbeResult } from "./mediabunny-clip"
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
    TRANSITION_AUDIO_BITRATE_MAX,
    TRANSITION_AUDIO_BITRATE_MIN,
} from "./transition-utils"

export interface RenderMergeOptions {
    files: File[]
    width: number
    height: number
    fps: number
    quality: TransitionQuality
    crf?: number | string | null
    audio_quality?: TransitionAudioQuality
    on_progress?: (progress: number) => void
    signal?: AbortSignal
}

export interface RenderMergeResult {
    blob: Blob
    extension: string
    mime: string
    cancel: () => Promise<void>
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported for in-browser merging."

function validate_merge_options(options: RenderMergeOptions): void {
    const { files, width, height, fps, quality } = options
    if (!Array.isArray(files) || files.length < 2) {
        throw new ClipError("INVALID_RANGE", "Merge needs at least 2 input files.")
    }
    if (files.length > 8) {
        throw new ClipError("INVALID_RANGE", "Merge supports at most 8 inputs.")
    }
    for (const file of files) {
        if (!(file instanceof File)) {
            throw new ClipError("INVALID_RANGE", "Merge inputs must be files.")
        }
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
        throw new ClipError("INVALID_RANGE", "Unknown merge quality.")
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
            throw new ClipError("INVALID_RANGE", "Unknown merge audio quality.")
        }
    }
}

function resolve_merge_audio_bitrate(probes: Array<ProbeResult | null>, choice: TransitionAudioQuality): number {
    let peak: number | null = null
    for (const probe of probes) {
        const candidate = probe?.audio_bitrate ?? probe?.overall_bitrate ?? null
        if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
            peak = peak === null ? candidate : Math.max(peak, candidate)
        }
    }
    if (choice !== "source-max") {
        return resolve_audio_bitrate(null, null, choice)
    }
    if (peak !== null) {
        return Math.min(TRANSITION_AUDIO_BITRATE_MAX, Math.max(TRANSITION_AUDIO_BITRATE_MIN, Math.round(peak)))
    }
    return resolve_audio_bitrate(null, null, "source-max")
}

export async function render_merge(options: RenderMergeOptions): Promise<RenderMergeResult> {
    const { files, width, height, fps, quality, on_progress, signal } = options
    validate_merge_options(options)
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const mb = await import("mediabunny")
    const inputs = files.map((file) => new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) }))
    let output: Output | null = null
    const on_abort = () => {
        void output?.cancel()
    }
    signal?.addEventListener("abort", on_abort, { once: true })
    try {
        for (const input of inputs) {
            if (!(await input.canRead())) {
                throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
            }
        }
        const probes = await Promise.all(files.map((file) => probe_media(file)))
        for (const probe of probes) {
            if (!probe || !probe.has_video || !probe.can_play) {
                throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
            }
            if (probe.duration === null || !Number.isFinite(probe.duration) || probe.duration <= 0) {
                throw new ClipError("INVALID_RANGE", "Merge source duration is unknown.")
            }
        }
        const durations = probes.map((probe) => probe.duration as number)
        const total = durations.reduce((sum, value) => sum + value, 0)
        if (!Number.isFinite(total) || total <= 0) {
            throw new ClipError("INVALID_RANGE", "Merge total duration must be greater than 0.")
        }
        const total_frames = Math.max(1, Math.round(total * fps))
        if (signal?.aborted) {
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        await ensure_aac_encoder(mb)
        const target = new mb.BufferTarget()
        output = new mb.Output({ format: new mb.Mp4OutputFormat(), target })
        const video_source = create_encode_video_source(mb, quality, width, height, fps, options.crf ?? null)
        output.addVideoTrack(video_source)
        const audio_tracks = await Promise.all(inputs.map((input) => input.getAudioTracks()))
        const has_audio = probes.some((probe, index) => probe.has_audio && (audio_tracks[index]?.[0] ?? null) !== null)
        const sinks = audio_tracks.map((tracks) => (tracks[0] ? new mb.AudioBufferSink(tracks[0]) : null))
        const decoded = await Promise.all(sinks.map((sink) => (sink ? decode_full_audio(sink) : null)))
        const mixed = await concat_audio_buffers({ buffers: decoded })
        let audio_source: InstanceType<typeof mb.AudioBufferSource> | null = null
        if (has_audio && mixed) {
            audio_source = new mb.AudioBufferSource({
                codec: "aac",
                bitrate: resolve_merge_audio_bitrate(probes, options.audio_quality ?? "source-max"),
            })
            output.addAudioTrack(audio_source)
        }
        await output.start()
        if (signal?.aborted) {
            await output.cancel()
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        if (audio_source && mixed) {
            await audio_source.add(mixed)
        }
        let frame_index = 0
        let elapsed = 0
        const { canvas, ctx: encode_ctx } = create_encode_canvas(width, height)
        const ctx = encode_ctx
        if (!ctx) {
            throw new ClipError("FAILED", "Could not acquire a 2D canvas context.")
        }
        for (let part = 0; part < inputs.length; part += 1) {
            if (signal?.aborted) {
                await output.cancel()
                throw new ClipError("CANCELLED", "Cancelled.")
            }
            const input = inputs[part]
            const video_tracks = await input.getVideoTracks()
            const video = video_tracks[0] ?? null
            if (!video) {
                throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
            }
            const duration = durations[part]
            const part_frames = part === inputs.length - 1 ? total_frames - frame_index : Math.round(duration * fps)
            const timestamps: number[] = []
            for (let i = 0; i < part_frames; i += 1) {
                timestamps.push(i / fps)
            }
            const sink = new mb.CanvasSink(video, { poolSize: 1 })
            const frames = sink.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]()
            for (let i = 0; i < part_frames; i += 1) {
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
                await add_canvas_frame(mb, video_source, canvas, elapsed, 1 / fps)
                elapsed += 1 / fps
                frame_index += 1
                on_progress?.(total_frames <= 1 ? 1 : frame_index / total_frames)
            }
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
            throw new ClipError("FAILED", "Merge rendering produced no output.")
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
        for (const input of inputs) {
            input.dispose()
        }
    }
}
