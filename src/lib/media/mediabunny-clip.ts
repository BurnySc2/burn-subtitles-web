import type { Conversion } from "mediabunny"

export interface ProbeResult {
    duration: number | null
    hasVideo: boolean
    hasAudio: boolean
    kind: "video" | "audio-only"
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

export function defaultOutputKind(probe: ProbeResult): ClipOutputKind {
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
        return { duration, hasVideo, hasAudio, kind: hasVideo ? "video" : "audio-only" }
    } finally {
        input.dispose()
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
