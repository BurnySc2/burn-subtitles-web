import type { Conversion } from "mediabunny"

export interface ProbeResult {
    duration: number | null
    hasVideo: boolean
    hasAudio: boolean
    kind: "video" | "audio-only"
    fileName: string
    fileSize: number
    container: string | null
    mimeType: string
    overallBitrate: number | null
    videoCount: number
    audioCount: number
    videoCodec: string | null
    videoCodecParam: string | null
    displayWidth: number | null
    displayHeight: number | null
    codedWidth: number | null
    codedHeight: number | null
    frameRate: number | null
    videoBitrate: number | null
    audioCodec: string | null
    audioCodecParam: string | null
    audioChannels: number | null
    audioSampleRate: number | null
    audioBitrate: number | null
    canPlay: boolean
}

export type ClipOutputKind = "mp4" | "wav" | "mp3"

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
    outputKind: ClipOutputKind
    onProgress?: (progress: number) => void
    signal?: AbortSignal
}

export interface ExtractClipResult {
    blob: Blob
    extension: string
    mime: string
    cancel: () => Promise<void>
}

const UNSUPPORTED_MESSAGE = "This codec isn't supported by MediaBunny in-browser. Try /clip v1."

export function defaultOutputKind(probe: Pick<ProbeResult, "hasVideo">): ClipOutputKind {
    return probe.hasVideo ? "mp4" : "wav"
}

export async function probeMedia(file: File): Promise<ProbeResult> {
    const mb = await import("mediabunny")
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) })
    try {
        if (!(await input.canRead())) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        const [video_tracks, audio_tracks] = await Promise.all([input.getVideoTracks(), input.getAudioTracks()])
        const video = video_tracks[0] ?? null
        const audio = audio_tracks[0] ?? null
        const hasVideo = video_tracks.length > 0
        const hasAudio = audio_tracks.length > 0
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
        let mimeType = file.type
        const probed_mime = await nullable(() => input.getMimeType())
        if (probed_mime) {
            mimeType = probed_mime
        }
        let videoCodec: string | null = null
        let videoCodecParam: string | null = null
        let displayWidth: number | null = null
        let displayHeight: number | null = null
        let codedWidth: number | null = null
        let codedHeight: number | null = null
        let frameRate: number | null = null
        let videoBitrate: number | null = null
        if (video) {
            videoCodec = await nullable(() => video.getCodec())
            videoCodecParam = await nullable(() => video.getCodecParameterString())
            if (videoCodecParam === null) {
                const internal = await nullable(() => video.getInternalCodecId())
                videoCodecParam = typeof internal === "string" || typeof internal === "number" ? String(internal) : null
            }
            displayWidth = await nullable(() => video.getDisplayWidth())
            displayHeight = await nullable(() => video.getDisplayHeight())
            codedWidth = await nullable(() => video.getCodedWidth())
            codedHeight = await nullable(() => video.getCodedHeight())
            videoBitrate =
                (await nullable(() => video.getAverageBitrate())) ?? (await nullable(() => video.getBitrate()))
            try {
                const metrics = await video.computeFrameRateMetrics()
                frameRate = typeof metrics.bestGuessFrameRate === "number" ? metrics.bestGuessFrameRate : null
            } catch {
                frameRate = null
            }
        }
        let audioCodec: string | null = null
        let audioCodecParam: string | null = null
        let audioChannels: number | null = null
        let audioSampleRate: number | null = null
        let audioBitrate: number | null = null
        if (audio) {
            audioCodec = await nullable(() => audio.getCodec())
            audioCodecParam = await nullable(() => audio.getCodecParameterString())
            if (audioCodecParam === null) {
                const internal = await nullable(() => audio.getInternalCodecId())
                audioCodecParam = typeof internal === "string" || typeof internal === "number" ? String(internal) : null
            }
            audioChannels = await nullable(() => audio.getNumberOfChannels())
            audioSampleRate = await nullable(() => audio.getSampleRate())
            audioBitrate =
                (await nullable(() => audio.getAverageBitrate())) ?? (await nullable(() => audio.getBitrate()))
        }
        let canPlay = true
        try {
            if (video) {
                canPlay = await video.canDecode()
                if (canPlay && audio) {
                    canPlay = await audio.canDecode()
                }
            } else if (audio) {
                canPlay = await audio.canDecode()
            }
        } catch {
            canPlay = true
        }
        return {
            duration,
            hasVideo,
            hasAudio,
            kind: hasVideo ? "video" : "audio-only",
            fileName: file.name,
            fileSize: file.size,
            container,
            mimeType,
            overallBitrate: duration !== null && duration > 0 ? (file.size * 8) / duration : null,
            videoCount: video_tracks.length,
            audioCount: audio_tracks.length,
            videoCodec,
            videoCodecParam,
            displayWidth,
            displayHeight,
            codedWidth,
            codedHeight,
            frameRate,
            videoBitrate,
            audioCodec,
            audioCodecParam,
            audioChannels,
            audioSampleRate,
            audioBitrate,
            canPlay,
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

export async function extractClip(options: ExtractClipOptions): Promise<ExtractClipResult> {
    const { file, start, end, outputKind, onProgress, signal } = options
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
            outputKind === "mp4"
                ? new mb.Mp4OutputFormat()
                : outputKind === "mp3"
                  ? new mb.Mp3OutputFormat()
                  : new mb.WavOutputFormat()
        const target = new mb.BufferTarget()
        const output = new mb.Output({ format, target })
        conversion = await mb.Conversion.init({ input, output, trim: { start, end } })
        if (signal?.aborted) {
            await conversion.cancel()
            throw new ClipError("CANCELLED", "Cancelled.")
        }
        if (!conversion.isValid) {
            throw new ClipError("UNSUPPORTED", UNSUPPORTED_MESSAGE)
        }
        if (onProgress) {
            conversion.onProgress = (progress: number) => onProgress(progress)
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
