import type { AudioBufferSink, Output } from "mediabunny"
import type { ProbeResult } from "./mediabunny-clip"
import { ClipError, probe_media } from "./mediabunny-clip"
import { premix_transition_audio } from "./transition-audio"
import type { TransitionEasing, TransitionQuality } from "./transition-utils"
import {
    phase_at,
    quality_to_video_config,
    total_transition_duration,
    total_transition_frames,
} from "./transition-utils"

export type { ProbeResult } from "./mediabunny-clip"
export { ClipError } from "./mediabunny-clip"
export type { TransitionEasing, TransitionQuality } from "./transition-utils"

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
    easing: TransitionEasing
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

const TRANSITION_AUDIO_BITRATE = 128_000

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

let aac_encoder_promise: Promise<void> | null = null

async function ensure_aac_encoder(mb: typeof import("mediabunny")): Promise<void> {
    aac_encoder_promise ??= (async () => {
        if (!(await mb.canEncodeAudio("aac"))) {
            const { registerAacEncoder } = await import("@mediabunny/aac-encoder")
            registerAacEncoder()
        }
    })()
    return aac_encoder_promise
}

function draw_contain_fit(
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number,
): void {
    const source_width = source.width
    const source_height = source.height
    if (source_width <= 0 || source_height <= 0) {
        return
    }
    const scale = Math.min(width / source_width, height / source_height)
    const draw_width = source_width * scale
    const draw_height = source_height * scale
    ctx.drawImage(source, (width - draw_width) / 2, (height - draw_height) / 2, draw_width, draw_height)
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

async function decode_full_audio(sink: AudioBufferSink): Promise<AudioBuffer | null> {
    const chunks: AudioBuffer[] = []
    for await (const wrapped of sink.buffers()) {
        chunks.push(wrapped.buffer)
    }
    const first = chunks[0]
    if (!first) {
        return null
    }
    if (chunks.length === 1) {
        return first
    }
    const channels = first.numberOfChannels
    let length = 0
    for (const chunk of chunks) {
        length += chunk.length
    }
    const full = new AudioBuffer({ numberOfChannels: channels, length, sampleRate: first.sampleRate })
    let offset = 0
    for (const chunk of chunks) {
        for (let channel = 0; channel < channels; channel += 1) {
            full.getChannelData(channel).set(
                chunk.getChannelData(Math.min(channel, chunk.numberOfChannels - 1)),
                offset,
            )
        }
        offset += chunk.length
    }
    return full
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
    let output: Output | null = null
    const on_abort = () => {
        void output?.cancel()
    }
    signal?.addEventListener("abort", on_abort, { once: true })
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
        const [video_tracks_a, video_tracks_b] = await Promise.all([input_a.getVideoTracks(), input_b.getVideoTracks()])
        const video_a = video_tracks_a[0] ?? null
        const video_b = video_tracks_b[0] ?? null
        if (!video_a || !video_b) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        if (signal?.aborted) {
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        await ensure_aac_encoder(mb)
        const target = new mb.BufferTarget()
        output = new mb.Output({ format: new mb.Mp4OutputFormat(), target })
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const video_source = new mb.CanvasSource(canvas, {
            codec: "avc",
            bitrate: quality_to_video_config(quality, width, height, fps).bitrate,
        })
        output.addVideoTrack(video_source)
        const [audio_tracks_a, audio_tracks_b] = await Promise.all([input_a.getAudioTracks(), input_b.getAudioTracks()])
        const audio_a = resolved_a.has_audio ? (audio_tracks_a[0] ?? null) : null
        const audio_b = resolved_b.has_audio ? (audio_tracks_b[0] ?? null) : null
        const audio_source =
            audio_a || audio_b ? new mb.AudioBufferSource({ codec: "aac", bitrate: TRANSITION_AUDIO_BITRATE }) : null
        if (audio_source) {
            output.addAudioTrack(audio_source)
        }
        const sink_audio_a = audio_a ? new mb.AudioBufferSink(audio_a) : null
        const sink_audio_b = audio_b ? new mb.AudioBufferSink(audio_b) : null
        const [full_a, full_b] = await Promise.all([
            sink_audio_a ? decode_full_audio(sink_audio_a) : null,
            sink_audio_b ? decode_full_audio(sink_audio_b) : null,
        ])
        const premixed =
            options.premixed_audio !== undefined
                ? options.premixed_audio
                : await premix_transition_audio({
                      full_a,
                      full_b,
                      start_a,
                      blend_duration: duration,
                      total_duration: total,
                      easing,
                  })
        await output.start()
        if (signal?.aborted) {
            await output.cancel()
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        if (audio_source && premixed) {
            await audio_source.add(premixed)
        }
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            throw new ClipError("FAILED", "Could not acquire a 2D canvas context.")
        }
        const sink_a = new mb.CanvasSink(video_a, { poolSize: 1 })
        const sink_b = new mb.CanvasSink(video_b, { poolSize: 1 })
        // S full timeline output=total: solo-a from A only, blend A+B, solo-b from B only
        const timestamps_a: number[] = []
        const timestamps_b: number[] = []
        for (let i = 0; i < total_frames; i += 1) {
            const output_t = i / fps
            const { phase } = phase_at(output_t, start_a, duration, total, easing)
            if (phase !== "solo-b") {
                timestamps_a.push(output_t)
            }
            if (phase !== "solo-a") {
                timestamps_b.push(output_t - start_a)
            }
        }
        const frames_a = sink_a.canvasesAtTimestamps(timestamps_a)[Symbol.asyncIterator]()
        const frames_b = sink_b.canvasesAtTimestamps(timestamps_b)[Symbol.asyncIterator]()
        for (let i = 0; i < total_frames; i += 1) {
            if (signal?.aborted) {
                await output.cancel()
                throw new ClipError("CANCELLED", "Cancelled.")
            }
            const output_t = i / fps
            const { phase, alpha } = phase_at(output_t, start_a, duration, total, easing)
            const wrapped_a = phase === "solo-b" ? null : (await frames_a.next()).value
            const wrapped_b = phase === "solo-a" ? null : (await frames_b.next()).value
            draw_transition_frame(ctx, wrapped_a?.canvas ?? null, wrapped_b?.canvas ?? null, width, height, alpha)
            await video_source.add(output_t, frame_duration)
            on_progress?.(total_frames <= 1 ? 1 : i / (total_frames - 1))
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
            throw new ClipError("FAILED", "Transition rendering produced no output.")
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
        input_a.dispose()
        input_b.dispose()
    }
}
