import type { Output } from "mediabunny"
import type { ProbeResult } from "./mediabunny-clip"
import { ClipError, probe_media } from "./mediabunny-clip"
import type { TransitionEasing, TransitionQuality } from "./transition-utils"
import { EASING_REGISTRY, quality_to_video_config } from "./transition-utils"

export type { ProbeResult } from "./mediabunny-clip"
export { ClipError } from "./mediabunny-clip"
export type { TransitionEasing, TransitionQuality } from "./transition-utils"

export interface RenderTransitionOptions {
    file_a: File
    file_b: File
    probe_a?: ProbeResult | null
    probe_b?: ProbeResult | null
    duration: number
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

function validate_transition_options(options: RenderTransitionOptions): number {
    const { file_a, file_b, duration, width, height, fps, quality, easing } = options
    if (!(file_a instanceof File) || !(file_b instanceof File)) {
        throw new ClipError("INVALID_RANGE", "Two source files are required to render a transition.")
    }
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new ClipError("INVALID_RANGE", "Transition duration must be greater than 0 seconds.")
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
    return frame_count
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

function mix_transition_audio(
    buffer_a: AudioBuffer | null,
    buffer_b: AudioBuffer | null,
    alpha: number,
    frame_duration: number,
): AudioBuffer | null {
    const reference = buffer_a ?? buffer_b
    if (!reference) {
        return null
    }
    const gain_a = 1 - alpha
    const length = Math.max(1, Math.round(reference.sampleRate * frame_duration))
    const mixed = new AudioBuffer({
        numberOfChannels: reference.numberOfChannels,
        length,
        sampleRate: reference.sampleRate,
    })
    for (let channel = 0; channel < mixed.numberOfChannels; channel += 1) {
        const out = mixed.getChannelData(channel)
        const data_a = buffer_a && channel < buffer_a.numberOfChannels ? buffer_a.getChannelData(channel) : null
        const data_b = buffer_b && channel < buffer_b.numberOfChannels ? buffer_b.getChannelData(channel) : null
        for (let i = 0; i < length; i += 1) {
            out[i] = (data_a?.[i] ?? 0) * gain_a + (data_b?.[i] ?? 0) * alpha
        }
    }
    return mixed
}

export async function render_transition(options: RenderTransitionOptions): Promise<RenderTransitionResult> {
    const { file_a, file_b, width, height, fps, quality, easing, on_progress, signal } = options
    const frame_count = validate_transition_options(options)
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
        await output.start()
        if (signal?.aborted) {
            await output.cancel()
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            throw new ClipError("FAILED", "Could not acquire a 2D canvas context.")
        }
        const sink_a = new mb.CanvasSink(video_a, { poolSize: 1 })
        const sink_b = new mb.CanvasSink(video_b, { poolSize: 1 })
        const timestamps: number[] = []
        for (let i = 0; i < frame_count; i += 1) {
            timestamps.push(i / fps)
        }
        // v1 output duration=D sampling A at t B at t, tail/head deferred
        const frames_a = sink_a.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]()
        const frames_b = sink_b.canvasesAtTimestamps(timestamps)[Symbol.asyncIterator]()
        const sink_audio_a = audio_a ? new mb.AudioBufferSink(audio_a) : null
        const sink_audio_b = audio_b ? new mb.AudioBufferSink(audio_b) : null
        const audios_a = sink_audio_a ? sink_audio_a.buffersAtTimestamps(timestamps)[Symbol.asyncIterator]() : null
        const audios_b = sink_audio_b ? sink_audio_b.buffersAtTimestamps(timestamps)[Symbol.asyncIterator]() : null
        const frame_duration = 1 / fps
        for (let i = 0; i < frame_count; i += 1) {
            if (signal?.aborted) {
                await output.cancel()
                throw new ClipError("CANCELLED", "Cancelled.")
            }
            const timestamp = i / fps
            const normalized = frame_count <= 1 ? 1 : i / (frame_count - 1)
            const alpha = EASING_REGISTRY[easing](normalized)
            const [{ value: wrapped_a }, { value: wrapped_b }] = await Promise.all([frames_a.next(), frames_b.next()])
            draw_transition_frame(ctx, wrapped_a?.canvas ?? null, wrapped_b?.canvas ?? null, width, height, alpha)
            await video_source.add(timestamp, frame_duration)
            if (audio_source && (audios_a || audios_b)) {
                const [next_a, next_b] = await Promise.all([audios_a?.next(), audios_b?.next()])
                const mixed = mix_transition_audio(
                    next_a?.value?.buffer ?? null,
                    next_b?.value?.buffer ?? null,
                    alpha,
                    frame_duration,
                )
                if (mixed) {
                    await audio_source.add(mixed)
                }
            }
            on_progress?.(frame_count <= 1 ? 1 : i / (frame_count - 1))
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
