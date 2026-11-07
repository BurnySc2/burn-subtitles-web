import { concat_audio_buffers } from "./compose-audio"
import type { ProbeResult } from "./mediabunny-clip"
import { ClipError, probe_media } from "./mediabunny-clip"
import type { TransitionAudioQuality, TransitionQuality } from "./transition-utils"
import {
    add_canvas_frame,
    CRF_INVALID_MESSAGE,
    decode_full_audio,
    draw_contain_fit,
    parse_crf_override,
    resolve_audio_bitrate,
    TRANSITION_AUDIO_BITRATE_MAX,
    TRANSITION_AUDIO_BITRATE_MIN,
    with_canvas_encode,
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
        const setup = await with_canvas_encode({
            width,
            height,
            fps,
            quality,
            crf_raw: options.crf ?? null,
            audio_probe: null,
            audio_quality: options.audio_quality ?? "source-max",
            needs_audio: false,
            probe_has_audio: false,
            head_blob_for_audio: null,
            audio: {
                kind: "provided",
                get_audio: async (audio_mb) => {
                    if (!probes.some((probe) => probe?.has_audio)) {
                        return { buffer: null, bitrate: null }
                    }
                    const audio_inputs = files.map(
                        (file) =>
                            new audio_mb.Input({
                                formats: audio_mb.ALL_FORMATS,
                                source: new audio_mb.BlobSource(file),
                            }),
                    )
                    try {
                        const audio_tracks = await Promise.all(audio_inputs.map((input) => input.getAudioTracks()))
                        const sinks = audio_tracks.map((tracks) =>
                            tracks[0] ? new audio_mb.AudioBufferSink(tracks[0]) : null,
                        )
                        const decoded = await Promise.all(sinks.map((sink) => (sink ? decode_full_audio(sink) : null)))
                        if (!decoded.some((buffer) => buffer !== null)) {
                            return { buffer: null, bitrate: null }
                        }
                        const mixed = await concat_audio_buffers({ buffers: decoded })
                        if (!mixed) {
                            return { buffer: null, bitrate: null }
                        }
                        return {
                            buffer: mixed,
                            bitrate: resolve_merge_audio_bitrate(probes, options.audio_quality ?? "source-max"),
                        }
                    } finally {
                        for (const input of audio_inputs) {
                            input.dispose()
                        }
                    }
                },
            },
            signal,
            body: async (encode_setup, encode_mb) => {
                const { canvas, ctx, video_source, output } = encode_setup
                let frame_index = 0
                let elapsed = 0
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
                    const part_frames =
                        part === inputs.length - 1
                            ? Math.max(0, total_frames - frame_index)
                            : Math.round(duration * fps)
                    const timestamps: number[] = []
                    for (let i = 0; i < part_frames; i += 1) {
                        timestamps.push(i / fps)
                    }
                    const sink = new encode_mb.CanvasSink(video, { poolSize: 1 })
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
                        await add_canvas_frame(encode_mb, video_source, canvas, elapsed, 1 / fps)
                        elapsed += 1 / fps
                        frame_index += 1
                        on_progress?.(total_frames <= 1 ? 1 : frame_index / total_frames)
                    }
                }
                return encode_setup
            },
        })
        if (!setup.target.buffer) {
            throw new ClipError("FAILED", "Merge rendering produced no output.")
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
        for (const input of inputs) {
            input.dispose()
        }
    }
}
