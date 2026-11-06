import type { ProbeResult } from "./mediabunny-clip"
import { ClipError, probe_media } from "./mediabunny-clip"
import { premix_transition_audio } from "./transition-audio"
import type {
    TransitionAudioMode,
    TransitionAudioQuality,
    TransitionEasing,
    TransitionQuality,
} from "./transition-utils"
import {
    add_canvas_frame,
    CRF_INVALID_MESSAGE,
    decode_full_audio,
    draw_contain_fit,
    parse_crf_override,
    phase_at,
    resolve_audio_bitrate,
    TRANSITION_AUDIO_BITRATE_MAX,
    TRANSITION_AUDIO_BITRATE_MIN,
    TRANSITION_AUDIO_MODES,
    total_transition_duration,
    total_transition_frames,
    with_canvas_encode,
} from "./transition-utils"

export type { ProbeResult } from "./mediabunny-clip"
export { ClipError } from "./mediabunny-clip"
export type {
    TransitionAudioMode,
    TransitionAudioQuality,
    TransitionEasing,
    TransitionQuality,
} from "./transition-utils"

export interface RenderTransitionOptions {
    file_a: File
    file_b: File
    probe_a?: ProbeResult | null
    probe_b?: ProbeResult | null
    duration: number
    start_a?: number
    total_duration?: number
    premixed_audio?: AudioBuffer | null
    width: number
    height: number
    fps: number
    quality: TransitionQuality
    crf?: number | string | null
    audio_quality?: TransitionAudioQuality
    audio_bitrate?: number
    easing: TransitionEasing
    audio_mode?: TransitionAudioMode
    on_progress?: (progress: number) => void
    signal?: AbortSignal
}

export interface RenderTransitionResult {
    blob: Blob
    extension: string
    mime: string
    cancel: () => Promise<void>
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported for in-browser transitions."

function resolve_render_audio_bitrate(options: RenderTransitionOptions): number {
    if (
        typeof options.audio_bitrate === "number" &&
        Number.isFinite(options.audio_bitrate) &&
        options.audio_bitrate > 0
    ) {
        return Math.min(
            TRANSITION_AUDIO_BITRATE_MAX,
            Math.max(TRANSITION_AUDIO_BITRATE_MIN, Math.round(options.audio_bitrate)),
        )
    }
    return resolve_audio_bitrate(
        options.probe_a ?? null,
        options.probe_b ?? null,
        options.audio_quality ?? "source-max",
    )
}

function resolve_render_crf(options: RenderTransitionOptions): number | null {
    try {
        return parse_crf_override(options.crf ?? null)
    } catch {
        throw new ClipError("INVALID_RANGE", CRF_INVALID_MESSAGE)
    }
}

function validate_transition_options(options: RenderTransitionOptions): void {
    const { file_a, file_b, duration, width, height, fps, quality, easing, total_duration } = options
    const start_a = options.start_a ?? 0
    if (!(file_a instanceof File) || !(file_b instanceof File)) {
        throw new ClipError("INVALID_RANGE", "Two source files are required to render a transition.")
    }
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new ClipError("INVALID_RANGE", "Transition duration must be greater than 0 seconds.")
    }
    if (!Number.isFinite(start_a) || start_a < 0) {
        throw new ClipError("INVALID_RANGE", "Transition start offset must be at or after 0 seconds.")
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
        throw new ClipError("INVALID_RANGE", "Unknown transition quality.")
    }
    if (easing !== "linear" && easing !== "exponential") {
        throw new ClipError("INVALID_RANGE", "Unknown transition easing.")
    }
    if (options.audio_mode !== undefined && !TRANSITION_AUDIO_MODES.includes(options.audio_mode)) {
        throw new ClipError("INVALID_RANGE", "Unknown transition audio mode.")
    }
    resolve_render_crf(options)
    if (options.audio_bitrate !== undefined) {
        if (!Number.isFinite(options.audio_bitrate) || options.audio_bitrate <= 0) {
            throw new ClipError("INVALID_RANGE", "Audio bitrate must be greater than 0.")
        }
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
            throw new ClipError("INVALID_RANGE", "Unknown transition audio quality.")
        }
    }
    const frame_count = Math.round(duration * fps)
    if (frame_count < 1) {
        throw new ClipError("INVALID_RANGE", "Transition duration and frame rate must yield at least one frame.")
    }
    if (total_duration !== undefined) {
        if (!Number.isFinite(total_duration) || total_duration <= 0) {
            throw new ClipError("INVALID_RANGE", "Total duration must be greater than 0 seconds.")
        }
        if (total_duration < duration) {
            throw new ClipError("INVALID_RANGE", "Total duration must be at least the transition duration.")
        }
        if (Math.round(total_duration * fps) < 1) {
            throw new ClipError("INVALID_RANGE", "Total duration and frame rate must yield at least one frame.")
        }
    }
}

export interface ResolvedTransitionTimeline {
    total: number
    total_frames: number
    frame_duration: number
}

export function resolve_transition_timeline(
    start_a: number,
    blend_duration: number,
    duration_b: number | null,
    total_override: number | undefined,
    fps: number,
): ResolvedTransitionTimeline {
    const total = total_override ?? total_transition_duration(start_a, duration_b)
    if (total === null) {
        throw new ClipError("INVALID_RANGE", "Source B duration is unknown — wait for probing to finish.")
    }
    if (!Number.isFinite(total) || total <= 0) {
        throw new ClipError("INVALID_RANGE", "Total duration must be greater than 0 seconds.")
    }
    if (total < blend_duration) {
        throw new ClipError("INVALID_RANGE", "Total duration must be at least the transition duration.")
    }
    const total_frames = total_transition_frames(total, fps)
    if (total_frames < 1) {
        throw new ClipError("INVALID_RANGE", "Total duration and frame rate must yield at least one frame.")
    }
    return { total, total_frames, frame_duration: 1 / fps }
}

function draw_transition_frame(
    ctx: CanvasRenderingContext2D,
    frame_a: HTMLCanvasElement | OffscreenCanvas | null,
    frame_b: HTMLCanvasElement | OffscreenCanvas | null,
    width: number,
    height: number,
    alpha: number,
): void {
    ctx.globalAlpha = 1
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)
    if (frame_a) {
        draw_contain_fit(ctx, frame_a, width, height)
    }
    if (frame_b && alpha > 0) {
        ctx.globalAlpha = alpha
        draw_contain_fit(ctx, frame_b, width, height)
        ctx.globalAlpha = 1
    }
}

export async function render_transition(options: RenderTransitionOptions): Promise<RenderTransitionResult> {
    const { file_a, file_b, duration, width, height, fps, quality, easing, on_progress, signal } = options
    const start_a = options.start_a ?? 0
    validate_transition_options(options)
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const mb = await import("mediabunny")
    const input_a = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file_a) })
    const input_b = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file_b) })
    try {
        if (!(await input_a.canRead()) || !(await input_b.canRead())) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const [resolved_a, resolved_b] = await Promise.all([
            options.probe_a ?? probe_media(file_a),
            options.probe_b ?? probe_media(file_b),
        ])
        for (const probe of [resolved_a, resolved_b]) {
            if (!probe || !probe.has_video || !probe.can_play) {
                throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
            }
        }
        const len_a = resolved_a.duration
        if (len_a !== null && start_a + duration > len_a) {
            throw new ClipError("INVALID_RANGE", "Transition start plus duration exceeds source A duration.")
        }
        const { total, total_frames, frame_duration } = resolve_transition_timeline(
            start_a,
            duration,
            resolved_b.duration,
            options.total_duration,
            fps,
        )
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
                    if (options.premixed_audio !== undefined) {
                        if (!options.premixed_audio) {
                            return { buffer: null, bitrate: null }
                        }
                        return {
                            buffer: options.premixed_audio,
                            bitrate: resolve_render_audio_bitrate({
                                ...options,
                                probe_a: resolved_a,
                                probe_b: resolved_b,
                            }),
                        }
                    }
                    if (!resolved_a.has_audio && !resolved_b.has_audio) {
                        return { buffer: null, bitrate: null }
                    }
                    const audio_inputs = [file_a, file_b].map(
                        (file) =>
                            new audio_mb.Input({
                                formats: audio_mb.ALL_FORMATS,
                                source: new audio_mb.BlobSource(file),
                            }),
                    )
                    try {
                        const audio_tracks = await Promise.all(audio_inputs.map((input) => input.getAudioTracks()))
                        const sink_audio_a =
                            resolved_a.has_audio && audio_tracks[0]?.[0]
                                ? new audio_mb.AudioBufferSink(audio_tracks[0][0])
                                : null
                        const sink_audio_b =
                            resolved_b.has_audio && audio_tracks[1]?.[0]
                                ? new audio_mb.AudioBufferSink(audio_tracks[1][0])
                                : null
                        const [full_a, full_b] = await Promise.all([
                            sink_audio_a ? decode_full_audio(sink_audio_a) : null,
                            sink_audio_b ? decode_full_audio(sink_audio_b) : null,
                        ])
                        const premixed = await premix_transition_audio({
                            full_a,
                            full_b,
                            start_a,
                            blend_duration: duration,
                            total_duration: total,
                            easing,
                            audio_mode: options.audio_mode,
                        })
                        if (!premixed) {
                            return { buffer: null, bitrate: null }
                        }
                        return {
                            buffer: premixed,
                            bitrate: resolve_render_audio_bitrate({
                                ...options,
                                probe_a: resolved_a,
                                probe_b: resolved_b,
                            }),
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
                const [video_tracks_a, video_tracks_b] = await Promise.all([
                    input_a.getVideoTracks(),
                    input_b.getVideoTracks(),
                ])
                const video_a = video_tracks_a[0] ?? null
                const video_b = video_tracks_b[0] ?? null
                if (!video_a || !video_b) {
                    throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
                }
                if (signal?.aborted) {
                    await output.cancel()
                    throw new ClipError("CANCELLED", "Cancelled.")
                }
                const forward_a = resolved_a.display_width === width && resolved_a.display_height === height
                const forward_b = resolved_b.display_width === width && resolved_b.display_height === height
                // S full timeline output=total: solo-a from A only, blend A+B, solo-b from B only
                const canvas_timestamps_a: number[] = []
                const canvas_timestamps_b: number[] = []
                const sample_timestamps_a: number[] = []
                const sample_timestamps_b: number[] = []
                for (let i = 0; i < total_frames; i += 1) {
                    const output_t = i / fps
                    const { phase } = phase_at(output_t, start_a, duration, total, easing)
                    if (phase === "solo-a") {
                        if (forward_a) {
                            sample_timestamps_a.push(output_t)
                        } else {
                            canvas_timestamps_a.push(output_t)
                        }
                    } else if (phase === "solo-b") {
                        if (forward_b) {
                            sample_timestamps_b.push(output_t - start_a)
                        } else {
                            canvas_timestamps_b.push(output_t - start_a)
                        }
                    } else {
                        canvas_timestamps_a.push(output_t)
                        canvas_timestamps_b.push(output_t - start_a)
                    }
                }
                const sink_a = new encode_mb.CanvasSink(video_a, { poolSize: 1 })
                const sink_b = new encode_mb.CanvasSink(video_b, { poolSize: 1 })
                const frames_a = sink_a.canvasesAtTimestamps(canvas_timestamps_a)[Symbol.asyncIterator]()
                const frames_b = sink_b.canvasesAtTimestamps(canvas_timestamps_b)[Symbol.asyncIterator]()
                const sink_samples_a = forward_a ? new encode_mb.VideoSampleSink(video_a) : null
                const sink_samples_b = forward_b ? new encode_mb.VideoSampleSink(video_b) : null
                const samples_a =
                    sink_samples_a?.samplesAtTimestamps(sample_timestamps_a)[Symbol.asyncIterator]() ?? null
                const samples_b =
                    sink_samples_b?.samplesAtTimestamps(sample_timestamps_b)[Symbol.asyncIterator]() ?? null
                for (let i = 0; i < total_frames; i += 1) {
                    if (signal?.aborted) {
                        await output.cancel()
                        throw new ClipError("CANCELLED", "Cancelled.")
                    }
                    const output_t = i / fps
                    const { phase, alpha } = phase_at(output_t, start_a, duration, total, easing)
                    if ((phase === "solo-a" && forward_a) || (phase === "solo-b" && forward_b)) {
                        const iterator = phase === "solo-a" ? samples_a : samples_b
                        const sample = iterator ? (await iterator.next()).value : null
                        if (sample) {
                            try {
                                sample.setTimestamp(output_t)
                                sample.setDuration(frame_duration)
                                await video_source.add(sample)
                            } finally {
                                sample.close()
                            }
                        } else {
                            draw_transition_frame(ctx, null, null, width, height, alpha)
                            await add_canvas_frame(encode_mb, video_source, canvas, output_t, frame_duration)
                        }
                        on_progress?.((i + 1) / total_frames)
                        continue
                    }
                    const wrapped_a = phase === "solo-b" ? null : (await frames_a.next()).value
                    const wrapped_b = phase === "solo-a" ? null : (await frames_b.next()).value
                    draw_transition_frame(
                        ctx,
                        wrapped_a?.canvas ?? null,
                        wrapped_b?.canvas ?? null,
                        width,
                        height,
                        alpha,
                    )
                    await add_canvas_frame(encode_mb, video_source, canvas, output_t, frame_duration)
                    on_progress?.((i + 1) / total_frames)
                }
                return encode_setup
            },
        })
        if (!setup.target.buffer) {
            throw new ClipError("FAILED", "Transition rendering produced no output.")
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
        input_a.dispose()
        input_b.dispose()
    }
}
