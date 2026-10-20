import { TimecodeError } from "./timecode"

export type TransitionResSource = "a" | "b"

export type TransitionFpsMode = "a" | "b" | "24" | "30" | "60"

export type TransitionQuality = "low" | "medium" | "high" | "very-high" | "ultra"

export type TransitionEasing = "linear" | "exponential"

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
    description: string
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

export function quality_to_video_config(
    quality: TransitionQuality,
    width: number,
    height: number,
    fps: number,
): TransitionVideoConfig {
    const bitrate = QUALITY_BITRATE[quality]
    return { bitrate, description: `${QUALITY_LABEL[quality]} ${width}x${height}@${fps}fps ${bitrate / 1_000_000}Mbps` }
}

export const FRAME_COUNT_WARNING_THRESHOLD = 1000

export function estimate_frame_count(duration: number, fps: number): number {
    return Math.round(duration * fps)
}
