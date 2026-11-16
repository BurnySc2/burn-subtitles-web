export const VIEWER_FALLBACK_FPS = 30

export function effective_fps(probe_fps: number | null | undefined): number {
    return typeof probe_fps === "number" && Number.isFinite(probe_fps) && probe_fps > 0
        ? probe_fps
        : VIEWER_FALLBACK_FPS
}

export function frame_duration(fps: number): number {
    if (!Number.isFinite(fps) || fps <= 0) {
        throw new Error(`Invalid fps "${fps}": expected finite number > 0`)
    }
    return 1 / fps
}

export function time_to_frame(time_s: number, fps: number): number {
    if (!Number.isFinite(fps) || fps <= 0) {
        throw new Error(`Invalid fps "${fps}": expected finite number > 0`)
    }
    return Math.max(0, Math.floor(time_s * fps + 1e-6))
}

export function frame_to_time(frame: number, fps: number): number {
    if (!Number.isFinite(fps) || fps <= 0) {
        throw new Error(`Invalid fps "${fps}": expected finite number > 0`)
    }
    if (!(frame >= 0)) {
        return 0
    }
    return frame / fps
}

export function clamp_to_duration(time_s: number, duration: number | null | undefined): number {
    const clamped = Math.max(0, time_s)
    if (typeof duration === "number" && Number.isFinite(duration)) {
        return Math.min(clamped, Math.max(0, duration))
    }
    return clamped
}

export function step_frame(
    time_s: number,
    fps: number,
    delta_frames: number,
    duration: number | null | undefined,
): number {
    if (!Number.isFinite(fps) || fps <= 0) {
        throw new Error(`Invalid fps "${fps}": expected finite number > 0`)
    }
    const current = time_to_frame(time_s, fps)
    const target = Math.max(0, current + delta_frames)
    const stepped = clamp_to_duration(frame_to_time(target, fps), duration)
    return stepped
}
