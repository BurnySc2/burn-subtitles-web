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
    video_color_space: string | null
    audio_codec: string | null
    audio_codec_param: string | null
    audio_channels: number | null
    audio_sample_rate: number | null
    audio_bitrate: number | null
    can_play: boolean
}

export type ClipOutputKind = "mp4" | "mp3" | "flac"

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
    return "flac"
}

async function try_probe<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn()
    } catch {
        return null
    }
}

let audio_encoders_promise: Promise<void> | null = null

async function ensure_audio_encoders(mb: typeof import("mediabunny")): Promise<void> {
    audio_encoders_promise ??= (async () => {
        if (!(await mb.canEncodeAudio("mp3"))) {
            const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder")
            registerMp3Encoder()
        }
        if (!(await mb.canEncodeAudio("flac"))) {
            const { registerFlacEncoder } = await import("@mediabunny/flac-encoder")
            registerFlacEncoder()
        }
    })()
    return audio_encoders_promise
}

type ProbeInput = InstanceType<typeof import("mediabunny").Input>
type VideoTrackLike = Awaited<ReturnType<ProbeInput["getVideoTracks"]>>[number]
type AudioTrackLike = Awaited<ReturnType<ProbeInput["getAudioTracks"]>>[number]

interface VideoProbe {
    video_codec: string | null
    video_codec_param: string | null
    display_width: number | null
    display_height: number | null
    coded_width: number | null
    coded_height: number | null
    frame_rate: number | null
    video_bitrate: number | null
    video_color_space: string | null
}

interface AudioProbe {
    audio_codec: string | null
    audio_codec_param: string | null
    audio_channels: number | null
    audio_sample_rate: number | null
    audio_bitrate: number | null
}

async function resolve_duration(input: ProbeInput): Promise<number | null> {
    const from_metadata = await try_probe(() => input.getDurationFromMetadata())
    if (from_metadata !== null) {
        return from_metadata
    }
    return try_probe(() => input.computeDuration())
}

function normalize_video_color_space(raw: unknown): string | null {
    if (typeof raw === "string") {
        const trimmed = raw.trim()
        return trimmed === "" ? null : trimmed
    }
    if (raw !== null && typeof raw === "object") {
        const record = raw as Record<string, unknown>
        const text_of = (value: unknown): string | null => {
            if (typeof value === "string") {
                const trimmed = value.trim()
                return trimmed === "" ? null : trimmed
            }
            if (typeof value === "number" || typeof value === "boolean") {
                const text = String(value).trim()
                return text === "" ? null : text
            }
            return null
        }
        const range_of = (): string | null => {
            const range = record["range"]
            if (typeof range === "string") {
                const trimmed = range.trim()
                if (trimmed !== "") {
                    return trimmed
                }
            } else if (typeof range === "boolean") {
                return range ? "full" : "limited"
            } else if (typeof range === "number") {
                const text = String(range).trim()
                if (text !== "") {
                    return text
                }
            }
            const full_range = record["fullRange"]
            if (typeof full_range === "boolean") {
                return full_range ? "full" : "limited"
            }
            return text_of(full_range)
        }
        const parts = [
            text_of(record["primaries"]),
            text_of(record["transfer"]),
            text_of(record["matrix"]),
            range_of(),
        ].filter((value): value is string => value !== null && value !== "")
        if (parts.length > 0) {
            return parts.join("/")
        }
    }
    return null
}

async function probe_video_track(video: VideoTrackLike | null): Promise<VideoProbe> {
    const fallback: VideoProbe = {
        video_codec: null,
        video_codec_param: null,
        display_width: null,
        display_height: null,
        coded_width: null,
        coded_height: null,
        frame_rate: null,
        video_bitrate: null,
        video_color_space: null,
    }
    if (!video) {
        return fallback
    }
    const video_codec = await try_probe(() => video.getCodec())
    let video_codec_param = await try_probe(() => video.getCodecParameterString())
    if (video_codec_param === null) {
        const internal = await try_probe(() => video.getInternalCodecId())
        video_codec_param = typeof internal === "string" || typeof internal === "number" ? String(internal) : null
    }
    const display_width = await try_probe(() => video.getDisplayWidth())
    const display_height = await try_probe(() => video.getDisplayHeight())
    const coded_width = await try_probe(() => video.getCodedWidth())
    const coded_height = await try_probe(() => video.getCodedHeight())
    const video_bitrate =
        (await try_probe(() => video.getAverageBitrate())) ?? (await try_probe(() => video.getBitrate()))
    let frame_rate: number | null = null
    try {
        const metrics = await video.computeFrameRateMetrics()
        frame_rate = typeof metrics.bestGuessFrameRate === "number" ? metrics.bestGuessFrameRate : null
    } catch {
        frame_rate = null
    }
    const color_space_raw = await try_probe(async () =>
        (video as unknown as { getColorSpace?: () => unknown }).getColorSpace?.(),
    )
    return {
        video_codec,
        video_codec_param,
        display_width,
        display_height,
        coded_width,
        coded_height,
        frame_rate,
        video_bitrate,
        video_color_space: normalize_video_color_space(color_space_raw),
    }
}

async function probe_audio_track(audio: AudioTrackLike | null): Promise<AudioProbe> {
    const fallback: AudioProbe = {
        audio_codec: null,
        audio_codec_param: null,
        audio_channels: null,
        audio_sample_rate: null,
        audio_bitrate: null,
    }
    if (!audio) {
        return fallback
    }
    const audio_codec = await try_probe(() => audio.getCodec())
    let audio_codec_param = await try_probe(() => audio.getCodecParameterString())
    if (audio_codec_param === null) {
        const internal = await try_probe(() => audio.getInternalCodecId())
        audio_codec_param = typeof internal === "string" || typeof internal === "number" ? String(internal) : null
    }
    const audio_channels = await try_probe(() => audio.getNumberOfChannels())
    const audio_sample_rate = await try_probe(() => audio.getSampleRate())
    const audio_bitrate =
        (await try_probe(() => audio.getAverageBitrate())) ?? (await try_probe(() => audio.getBitrate()))
    return { audio_codec, audio_codec_param, audio_channels, audio_sample_rate, audio_bitrate }
}

async function probe_decodability(video: VideoTrackLike | null, audio: AudioTrackLike | null): Promise<boolean> {
    try {
        if (video) {
            if (!(await video.canDecode())) {
                return false
            }
            if (audio) {
                return await audio.canDecode()
            }
            return true
        }
        if (audio) {
            return await audio.canDecode()
        }
        return true
    } catch {
        return true
    }
}

const probe_cache = new Map<string, Promise<ProbeResult>>()

function probe_cache_key(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}:${file.type}`
}

export function clear_probe_cache(): void {
    probe_cache.clear()
}

export function probe_media(file: File): Promise<ProbeResult> {
    const key = probe_cache_key(file)
    const cached = probe_cache.get(key)
    if (cached) {
        return cached
    }
    const pending = probe_media_uncached(file)
    pending.catch(() => {
        if (probe_cache.get(key) === pending) {
            probe_cache.delete(key)
        }
    })
    probe_cache.set(key, pending)
    return pending
}

async function probe_media_uncached(file: File): Promise<ProbeResult> {
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
        const duration = await resolve_duration(input)
        const container = await try_probe(() => input.getFormat().then((format) => format.name))
        let mime_type = file.type
        const probed_mime = await try_probe(() => input.getMimeType())
        if (probed_mime) {
            mime_type = probed_mime
        }
        const video_info = await probe_video_track(video)
        const audio_info = await probe_audio_track(audio)
        const can_play = await probe_decodability(video, audio)
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
            ...video_info,
            ...audio_info,
            can_play,
        }
    } finally {
        input.dispose()
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
                  : new mb.FlacOutputFormat()
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
