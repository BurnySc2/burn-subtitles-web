import type { ProbeResult } from "./mediabunny-clip"
import type { LoudnessCache } from "./viewer-loudness"

export type LoudnessStatus = "idle" | "analyzing" | "ready" | "failed"

export interface ViewerSource {
    file: File
    url: string
    probe: ProbeResult | null
    loudness: LoudnessCache | null
    loudness_status: LoudnessStatus
}

export interface ViewerPlayback {
    current_time: number | null
    presented_frame: number | null
    rvfc_supported: boolean
    measured_fps: number | null
}

export interface ViewerState {
    source: ViewerSource | null
    playback: ViewerPlayback
    error: string | null
    message: string | null
}

function initial_state(): ViewerState {
    return {
        source: null,
        playback: {
            current_time: null,
            presented_frame: null,
            rvfc_supported: false,
            measured_fps: null,
        },
        error: null,
        message: null,
    }
}

export const viewer_state: ViewerState = $state(initial_state())

export function reset_playback(): void {
    const fresh = initial_state()
    if (viewer_state.source) {
        viewer_state.source.loudness = null
        viewer_state.source.loudness_status = "idle"
    }
    viewer_state.playback = fresh.playback
    viewer_state.error = null
    viewer_state.message = null
}

export function revoke_viewer(): void {
    if (viewer_state.source) {
        URL.revokeObjectURL(viewer_state.source.url)
    }
    const fresh = initial_state()
    viewer_state.source = fresh.source
    viewer_state.playback = fresh.playback
    viewer_state.error = fresh.error
    viewer_state.message = fresh.message
}
