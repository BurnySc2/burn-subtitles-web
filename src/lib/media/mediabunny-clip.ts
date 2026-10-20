import type { Conversion } from "mediabunny"

export interface ProbeResult {
    duration: number | null
    has_video: boolean
    has_audio: boolean
    kind: "video" | "audio-only"
    file_name: string
    file_size: number
    container: string | null
    mime_type: string
    overall_bitrate: number | null
    video_count: number
    audio_count: number
    video_codec: string | null
    video_codec_param: string | null
    display_width: number | null
    display_height: number | null
    coded_width: number | null
    coded_height: number | null
    frame_rate: number | null
    video_bitrate: number | null
    audio_codec: string | null
    audio_codec_param: string | null
    audio_channels: number | null
    audio_sample_rate: number | null
    audio_bitrate: number | null
    can_play: boolean
}

export type ClipOutputKind = "mp4" | "wav" | "mp3" | "flac"

export type ClipErrorCode = "UNSUPPORTED" | "CANCELLED" | "INVALID_RANGE" | "FAILED"

export class ClipError extends Error {
    readonly code: ClipErrorCode
    constructor(code: ClipErrorCode, message: string) {
        super(message)
        this.name = "ClipError"
        this.code = code
    }
}

export interface ExtractClipOptions {
    file: File
    start: number
    end: number
    output_kind: ClipOutputKind
    on_progress?: (progress: number) => void
    signal?: AbortSignal
}

export interface ExtractClipResult {
    blob: Blob
    extension: string
    mime: string
    cancel: () => Promise<void>
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported for in-browser trimming."

export function default_output_kind(
    probe: Pick<ProbeResult, "has_video"> & Partial<Pick<ProbeResult, "audio_codec" | "container">>,
): ClipOutputKind {
    if (probe.has_video) {
        return "mp4"
    }
    const haystack = `${probe.audio_codec ?? ""} ${probe.container ?? ""}`.toLowerCase()
    if (haystack.includes("mp3")) {
        return "mp3"
    }
    if (haystack.includes("flac")) {
        return "flac"
    }
    return "flac"
}

let audio_encoders_ready = false

async function ensure_audio_encoders(mb: typeof import("mediabunny")): Promise<void> {
    if (audio_encoders_ready) {
        return
    }
    if (!(await mb.canEncodeAudio("mp3"))) {
        const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder")
        registerMp3Encoder()
    }
    if (!(await mb.canEncodeAudio("flac"))) {
        const { registerFlacEncoder } = await import("@mediabunny/flac-encoder")
        registerFlacEncoder()
    }
    audio_encoders_ready = true
}

export async function probe_media(file: File): Promise<ProbeResult> {
    const mb = await import("mediabunny")
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) })
    try {
        if (!(await input.canRead())) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const [video_tracks, audio_tracks] = await Promise.all([input.getVideoTracks(), input.getAudioTracks()])
        const video = video_tracks[0] ?? null
        const audio = audio_tracks[0] ?? null
        const has_video = video_tracks.length > 0
        const has_audio = audio_tracks.length > 0
        let duration: number | null = null
        try {
            duration = await input.getDurationFromMetadata()
        } catch {
            duration = null
        }
        if (duration === null) {
            try {
                duration = await input.computeDuration()
            } catch {
                duration = null
            }
        }
        const container = await nullable(() => input.getFormat().then((format) => format.name))
        let mime_type = file.type
        const probed_mime = await nullable(() => input.getMimeType())
        if (probed_mime) {
            mime_type = probed_mime
        }
        let video_codec: string | null = null
        let video_codec_param: string | null = null
        let display_width: number | null = null
        let display_height: number | null = null
        let coded_width: number | null = null
        let coded_height: number | null = null
        let frame_rate: number | null = null
        let video_bitrate: number | null = null
        if (video) {
            video_codec = await nullable(() => video.getCodec())
            video_codec_param = await nullable(() => video.getCodecParameterString())
            if (video_codec_param === null) {
                const internal = await nullable(() => video.getInternalCodecId())
                video_codec_param =
                    typeof internal === "string" || typeof internal === "number" ? String(internal) : null
            }
            display_width = await nullable(() => video.getDisplayWidth())
            display_height = await nullable(() => video.getDisplayHeight())
            coded_width = await nullable(() => video.getCodedWidth())
            coded_height = await nullable(() => video.getCodedHeight())
            video_bitrate =
                (await nullable(() => video.getAverageBitrate())) ?? (await nullable(() => video.getBitrate()))
            try {
                const metrics = await video.computeFrameRateMetrics()
                frame_rate = typeof metrics.bestGuessFrameRate === "number" ? metrics.bestGuessFrameRate : null
            } catch {
                frame_rate = null
            }
        }
        let audio_codec: string | null = null
        let audio_codec_param: string | null = null
        let audio_channels: number | null = null
        let audio_sample_rate: number | null = null
        let audio_bitrate: number | null = null
        if (audio) {
            audio_codec = await nullable(() => audio.getCodec())
            audio_codec_param = await nullable(() => audio.getCodecParameterString())
            if (audio_codec_param === null) {
                const internal = await nullable(() => audio.getInternalCodecId())
                audio_codec_param =
                    typeof internal === "string" || typeof internal === "number" ? String(internal) : null
            }
            audio_channels = await nullable(() => audio.getNumberOfChannels())
            audio_sample_rate = await nullable(() => audio.getSampleRate())
            audio_bitrate =
                (await nullable(() => audio.getAverageBitrate())) ?? (await nullable(() => audio.getBitrate()))
        }
        let can_play = true
        try {
            if (video) {
                can_play = await video.canDecode()
                if (can_play && audio) {
                    can_play = await audio.canDecode()
                }
            } else if (audio) {
                can_play = await audio.canDecode()
            }
        } catch {
            can_play = true
        }
        return {
            duration,
            has_video,
            has_audio,
            kind: has_video ? "video" : "audio-only",
            file_name: file.name,
            file_size: file.size,
            container,
            mime_type,
            overall_bitrate: duration !== null && duration > 0 ? (file.size * 8) / duration : null,
            video_count: video_tracks.length,
            audio_count: audio_tracks.length,
            video_codec,
            video_codec_param,
            display_width,
            display_height,
            coded_width,
            coded_height,
            frame_rate,
            video_bitrate,
            audio_codec,
            audio_codec_param,
            audio_channels,
            audio_sample_rate,
            audio_bitrate,
            can_play,
        }
    } finally {
        input.dispose()
    }
}

async function nullable<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn()
    } catch {
        return null
    }
}

export async function extract_clip(options: ExtractClipOptions): Promise<ExtractClipResult> {
    const { file, start, end, output_kind, on_progress, signal } = options
    if (!(end > start) || start < 0) {
        throw new ClipError("INVALID_RANGE", "End time must be greater than start time")
    }
    if (signal?.aborted) {
        throw new ClipError("CANCELLED", "Cancelled.")
    }
    const mb = await import("mediabunny")
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) })
    let conversion: Conversion | null = null
    const on_abort = () => {
        void conversion?.cancel()
    }
    signal?.addEventListener("abort", on_abort, { once: true })
    try {
        if (!(await input.canRead())) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const format =
            output_kind === "mp4"
                ? new mb.Mp4OutputFormat()
                : output_kind === "mp3"
                  ? new mb.Mp3OutputFormat()
                  : output_kind === "flac"
                    ? new mb.FlacOutputFormat()
                    : new mb.WavOutputFormat()
        const target = new mb.BufferTarget()
        const output = new mb.Output({ format, target })
        await ensure_audio_encoders(mb)
        conversion = await mb.Conversion.init({ input, output, trim: { start, end } })
        if (signal?.aborted) {
            await conversion.cancel()
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        if (!conversion.isValid) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        if (on_progress) {
            conversion.onProgress = (progress: number) => on_progress(progress)
        }
        try {
            await conversion.execute()
        } catch (error) {
            if (
                error instanceof mb.ConversionCanceledError ||
                (error instanceof Error && error.name === "ConversionCanceledError")
            ) {
                throw new ClipError("CANCELLED", "Cancelled.")
            }
            throw error
        }
        if (!target.buffer) {
            throw new ClipError("FAILED", "Clip extraction produced no output.")
        }
        const done = conversion
        const blob = new Blob([target.buffer], { type: format.mimeType })
        return {
            blob,
            extension: format.fileExtension,
            mime: format.mimeType,
            cancel: () => done.cancel(),
        }
    } finally {
        signal?.removeEventListener("abort", on_abort)
        input.dispose()
    }
}
