import type { AudioBufferSink } from "mediabunny"
import { TimecodeError } from "./timecode"

export type TransitionResSource = "a" | "b"

export type TransitionFpsMode = "a" | "b" | "24" | "30" | "60"

export type TransitionQuality = "low" | "medium" | "high" | "very-high" | "ultra"

export type TransitionAudioQuality = "96k" | "128k" | "192k" | "256k" | "320k" | "source-max"

export type TransitionEasing = "linear" | "exponential"

export type TransitionAudioMode =
    | "crossfade"
    | "a-flat"
    | "a-fadeout"
    | "b-flat"
    | "b-fadein"
    | "mute"
    | "dip"
    | "a-only"
    | "b-only"

export const TRANSITION_AUDIO_MODES: readonly TransitionAudioMode[] = [
    "crossfade",
    "a-flat",
    "a-fadeout",
    "b-flat",
    "b-fadein",
    "mute",
    "dip",
    "a-only",
    "b-only",
]

export const TRANSITION_AUDIO_MODE_DEFAULT: TransitionAudioMode = "crossfade"

export const TRANSITION_AUDIO_MODE_HINTS: Record<TransitionAudioMode, string> = {
    crossfade: "Fade A out while B fades in.",
    "a-flat": "Keep A loud until blend ends, then switch to B.",
    "a-fadeout": "Fade A out during blend; B starts after.",
    "b-flat": "Play B under blend while A fades out.",
    "b-fadein": "Cut A at blend start, then fade B in.",
    mute: "Silence during blend; B starts after.",
    dip: "Dip both to silence mid-blend.",
    "a-only": "Play only A for the whole output; B is muted. Renders silence if that side has no audio.",
    "b-only":
        "Play only B from the start; B audio leads picture by the A-offset. Renders silence if that side has no audio.",
}
export type TransitionFn = (u: number) => number

export const EASING_REGISTRY: Record<TransitionEasing, TransitionFn> = {
    linear: (u) => u,
    exponential: (u) => u * u,
}

export interface TransitionDimsProbe {
    display_width: number | null
    display_height: number | null
}

export interface TransitionFpsProbe {
    frame_rate: number | null
}

export interface TransitionVideoConfig {
    bitrate: number
    quantizer: number | null
    description: string
}

export interface TransitionAudioBitrateProbe {
    audio_bitrate: number | null
    overall_bitrate: number | null
}

export function resolve_output_dims(
    probe_a: TransitionDimsProbe | null,
    probe_b: TransitionDimsProbe | null,
    res_source: TransitionResSource,
): { width: number; height: number } | null {
    const ordered = res_source === "a" ? [probe_a, probe_b] : [probe_b, probe_a]
    for (const probe of ordered) {
        if (probe?.display_width != null && probe?.display_height != null) {
            return { width: probe.display_width, height: probe.display_height }
        }
    }
    return null
}

const FALLBACK_FPS = 30

export function resolve_output_fps(
    probe_a: TransitionFpsProbe | null,
    probe_b: TransitionFpsProbe | null,
    fps_mode: TransitionFpsMode,
): number {
    if (fps_mode === "24" || fps_mode === "30" || fps_mode === "60") {
        return Number(fps_mode)
    }
    const probe = fps_mode === "a" ? probe_a : probe_b
    const fps = probe?.frame_rate
    if (typeof fps === "number" && Number.isFinite(fps) && fps > 0) {
        return fps
    }
    return FALLBACK_FPS
}

export function resolve_duration_seconds(
    duration_str: string,
    duration_a: number | null,
    duration_b: number | null,
): number {
    const parsed = Number.parseFloat(duration_str.trim())
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new TimecodeError(`Invalid transition duration "${duration_str}": expected seconds greater than 0`)
    }
    const bounds = [duration_a, duration_b].filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
    )
    if (bounds.length > 0 && parsed > Math.min(...bounds)) {
        throw new TimecodeError(
            `Invalid transition duration "${duration_str}": exceeds shortest source of ${Math.min(...bounds)}s`,
        )
    }
    return parsed
}

export function resolve_start_seconds(start_str: string, duration_a: number | null, duration: number): number {
    const parsed = Number.parseFloat(start_str.trim())
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new TimecodeError(`Invalid transition start "${start_str}": expected seconds at or after 0`)
    }
    if (duration_a === null || !Number.isFinite(duration_a)) {
        throw new TimecodeError("Source A duration is unknown — wait for probing to finish.")
    }
    if (parsed + duration > duration_a) {
        throw new TimecodeError(
            `Invalid transition start "${start_str}": start plus duration exceeds source A of ${duration_a}s`,
        )
    }
    return parsed
}

export function validate_transition_range(
    start: number,
    duration: number,
    duration_a: number | null,
    duration_b: number | null,
): void {
    if (!Number.isFinite(start) || start < 0) {
        throw new TimecodeError(`Invalid transition start "${start}": expected seconds at or after 0`)
    }
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new TimecodeError(`Invalid transition duration "${duration}": expected seconds greater than 0`)
    }
    if (duration_a !== null && start + duration > duration_a) {
        throw new TimecodeError(`Invalid transition range: start plus duration exceeds source A of ${duration_a}s`)
    }
    if (duration_b !== null && duration > duration_b) {
        throw new TimecodeError(`Invalid transition range: duration exceeds source B of ${duration_b}s`)
    }
}

const QUALITY_BITRATE: Record<TransitionQuality, number> = {
    low: 2_000_000,
    medium: 5_000_000,
    high: 10_000_000,
    "very-high": 16_000_000,
    ultra: 50_000_000,
}

const QUALITY_LABEL: Record<TransitionQuality, string> = {
    low: "low",
    medium: "medium",
    high: "high",
    "very-high": "very-high",
    ultra: "Ultra (~50 Mbps, high-bitrate for further processing, not bit-exact)",
}

export const QUALITY_QUANTIZER: Record<TransitionQuality, number | null> = {
    low: 30,
    medium: 26,
    high: 22,
    "very-high": 18,
    ultra: null,
}

export const TRANSITION_AUDIO_BITRATE_DEFAULT = 128_000
export const TRANSITION_AUDIO_BITRATE_MIN = 96_000
export const TRANSITION_AUDIO_BITRATE_MAX = 320_000

const AUDIO_BITRATE_PRESET: Record<Exclude<TransitionAudioQuality, "source-max">, number> = {
    "96k": 96_000,
    "128k": 128_000,
    "192k": 192_000,
    "256k": 256_000,
    "320k": 320_000,
}

export function resolve_audio_bitrate(
    probe_a: TransitionAudioBitrateProbe | null,
    probe_b: TransitionAudioBitrateProbe | null,
    choice: TransitionAudioQuality,
): number {
    if (choice !== "source-max") {
        return AUDIO_BITRATE_PRESET[choice]
    }
    const audio_candidates = [probe_a?.audio_bitrate, probe_b?.audio_bitrate].filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
    )
    if (audio_candidates.length > 0) {
        const peak = Math.max(...audio_candidates)
        return Math.min(TRANSITION_AUDIO_BITRATE_MAX, Math.max(TRANSITION_AUDIO_BITRATE_MIN, Math.round(peak)))
    }
    const overall_candidates = [probe_a?.overall_bitrate, probe_b?.overall_bitrate].filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
    )
    const peak = overall_candidates.length > 0 ? Math.max(...overall_candidates) : TRANSITION_AUDIO_BITRATE_DEFAULT
    return Math.min(TRANSITION_AUDIO_BITRATE_MAX, Math.max(TRANSITION_AUDIO_BITRATE_MIN, Math.round(peak)))
}

export function parse_crf_override(raw: number | string | null | undefined): number | null {
    if (raw === null || raw === undefined) {
        return null
    }
    if (typeof raw === "string" && raw.trim() === "") {
        return null
    }
    const parsed = typeof raw === "number" ? raw : Number(String(raw).trim())
    if (typeof raw !== "number" && !/^-?(\d+(\.\d*)?|\.\d+)$/.test(String(raw).trim())) {
        throw new TimecodeError(`Invalid CRF "${raw}": expected a number from 0 to 51`)
    }
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 51) {
        throw new TimecodeError(`Invalid CRF "${raw}": expected a number from 0 to 51`)
    }
    return parsed
}

export function quality_to_video_config(
    quality: TransitionQuality,
    width: number,
    height: number,
    fps: number,
    crf_override?: number | null,
): TransitionVideoConfig {
    const bitrate = QUALITY_BITRATE[quality]
    const quantizer =
        crf_override === null || crf_override === undefined
            ? QUALITY_QUANTIZER[quality]
            : Number.isFinite(crf_override)
              ? crf_override
              : QUALITY_QUANTIZER[quality]
    return {
        bitrate,
        quantizer,
        description: `${QUALITY_LABEL[quality]} ${width}x${height}@${fps}fps ${bitrate / 1_000_000}Mbps`,
    }
}

export const FRAME_COUNT_WARNING_THRESHOLD = 1000

export function estimate_frame_count(duration: number, fps: number): number {
    return Math.round(duration * fps)
}

export type TransitionPhase = "solo-a" | "blend" | "solo-b"

export function phase_at(
    t_global: number,
    start_a: number,
    blend_duration: number,
    total_duration: number,
    easing: TransitionEasing = "linear",
): { phase: TransitionPhase; alpha: number } {
    if (t_global < 0 || t_global < start_a) {
        return { phase: "solo-a", alpha: 0 }
    }
    if (t_global >= total_duration) {
        return { phase: "solo-b", alpha: 1 }
    }
    if (!Number.isFinite(blend_duration) || blend_duration <= 0) {
        return { phase: "solo-b", alpha: 1 }
    }
    if (t_global < start_a + blend_duration) {
        const u = Math.min(1, Math.max(0, (t_global - start_a) / blend_duration))
        return { phase: "blend", alpha: EASING_REGISTRY[easing](u) }
    }
    return { phase: "solo-b", alpha: 1 }
}

export function total_transition_duration(start_a: number, duration_b: number | null): number | null {
    if (duration_b === null) {
        return null
    }
    return start_a + duration_b
}

export function total_transition_frames(total_duration: number, fps: number): number {
    return Math.round(total_duration * fps)
}

export const OUTPUT_COLOR_SPACE: Readonly<VideoColorSpaceInit> = Object.freeze({
    primaries: "bt709",
    transfer: "bt709",
    matrix: "bt709",
    fullRange: false,
})

// WHY vui-pin: the encoder derives MP4 VUI from each frame, and canvas frames default to full-range sRGB.
export async function add_canvas_frame(
    mb: typeof import("mediabunny"),
    video_source: InstanceType<typeof mb.VideoSampleSource>,
    canvas: HTMLCanvasElement,
    timestamp: number,
    duration: number,
): Promise<void> {
    const init: VideoFrameInit & { colorSpace: VideoColorSpaceInit } = {
        timestamp: Math.trunc(timestamp * 1_000_000),
        duration: Math.trunc(duration * 1_000_000),
        colorSpace: OUTPUT_COLOR_SPACE,
    }
    const frame = new VideoFrame(canvas, init)
    try {
        const sample = new mb.VideoSample(frame, { timestamp, duration })
        try {
            await video_source.add(sample)
        } finally {
            sample.close()
        }
    } finally {
        frame.close()
    }
}

export const CRF_INVALID_MESSAGE = "CRF override must be a number from 0 to 51."

let aac_encoder_promise: Promise<void> | null = null

export async function ensure_aac_encoder(mb: typeof import("mediabunny")): Promise<void> {
    aac_encoder_promise ??= (async () => {
        try {
            if (!(await mb.canEncodeAudio("aac"))) {
                const { registerAacEncoder } = await import("@mediabunny/aac-encoder")
                registerAacEncoder()
            }
        } catch (error) {
            aac_encoder_promise = null
            throw error
        }
    })()
    return aac_encoder_promise
}

export interface EncodeCanvas {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D | null
}

export function create_encode_canvas(width: number, height: number): EncodeCanvas {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d", { colorSpace: "srgb", alpha: false })
    if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
    }
    return { canvas, ctx }
}

export function resolve_video_encode_config(
    quality: TransitionQuality,
    width: number,
    height: number,
    fps: number,
    crf_raw: number | string | null | undefined,
): TransitionVideoConfig {
    return quality_to_video_config(quality, width, height, fps, parse_crf_override(crf_raw ?? null))
}

export function create_video_sample_source(
    mb: typeof import("mediabunny"),
    config: TransitionVideoConfig,
    overrides?: {
        color_space?: VideoColorSpaceInit
        hardware_acceleration?: "no-preference" | "prefer-hardware" | "prefer-software"
        on_encoder_config?: (config: unknown) => void
    },
): InstanceType<typeof mb.VideoSampleSource> {
    const quality =
        config.quantizer !== null
            ? new mb.Quality({ quantizer: config.quantizer, bitrate: config.bitrate, bitrateMode: "variable" })
            : new mb.Quality({ bitrate: config.bitrate, bitrateMode: "variable" })
    const color_space = overrides?.color_space ?? OUTPUT_COLOR_SPACE
    return new mb.VideoSampleSource({
        codec: "avc",
        quality,
        latencyMode: "quality",
        hardwareAcceleration: overrides?.hardware_acceleration ?? "no-preference",
        bitrateMode: "variable",
        onEncodedPacket: (_packet, meta) => {
            if (meta?.decoderConfig) {
                meta.decoderConfig = { ...meta.decoderConfig, colorSpace: color_space }
            }
        },
        ...(overrides?.on_encoder_config ? { onEncoderConfig: overrides.on_encoder_config } : {}),
    })
}

export function create_encode_video_source(
    mb: typeof import("mediabunny"),
    quality: TransitionQuality,
    width: number,
    height: number,
    fps: number,
    crf_raw: number | string | null | undefined,
    overrides?: {
        color_space?: VideoColorSpaceInit
        hardware_acceleration?: "no-preference" | "prefer-hardware" | "prefer-software"
        on_encoder_config?: (config: unknown) => void
    },
): InstanceType<typeof mb.VideoSampleSource> {
    return create_video_sample_source(mb, resolve_video_encode_config(quality, width, height, fps, crf_raw), overrides)
}

export function draw_contain_fit(
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

export async function decode_full_audio(sink: AudioBufferSink): Promise<AudioBuffer | null> {
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
