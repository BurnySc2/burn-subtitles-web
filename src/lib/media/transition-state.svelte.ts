import type { ClipResult } from "./clip-v2-state.svelte"
import type { ProbeResult } from "./mediabunny-clip"
import type {
    TransitionAudioQuality,
    TransitionEasing,
    TransitionFpsMode,
    TransitionQuality,
    TransitionResSource,
} from "./transition-utils"

export interface TransitionSource {
    file: File
    url: string
    probe: ProbeResult | null
}

export interface TransitionState {
    source_a: TransitionSource | null
    source_b: TransitionSource | null
    duration_str: string
    start_str: string
    res_source: TransitionResSource
    fps_mode: TransitionFpsMode
    quality: TransitionQuality
    audio_quality: TransitionAudioQuality
    crf_override?: number | string | null
    easing: TransitionEasing
    is_processing: boolean
    progress: number
    result: ClipResult | null
    error: string | null
    message: string | null
}

function initial_state(): TransitionState {
    return {
        source_a: null,
        source_b: null,
        duration_str: "1.0",
        start_str: "0",
        res_source: "a",
        fps_mode: "a",
        quality: "high",
        audio_quality: "source-max",
        crf_override: undefined,
        easing: "linear",
        is_processing: false,
        progress: 0,
        result: null,
        error: null,
        message: null,
    }
}

export const transition_state: TransitionState = $state(initial_state())

export function reset_output_transition(): void {
    if (transition_state.result) {
        URL.revokeObjectURL(transition_state.result.url)
    }
    transition_state.result = null
    transition_state.error = null
    transition_state.message = null
    transition_state.progress = 0
}

export function revoke_all_transition(): void {
    if (transition_state.source_a) {
        URL.revokeObjectURL(transition_state.source_a.url)
    }
    if (transition_state.source_b) {
        URL.revokeObjectURL(transition_state.source_b.url)
    }
    if (transition_state.result) {
        URL.revokeObjectURL(transition_state.result.url)
    }
    const fresh = initial_state()
    transition_state.source_a = fresh.source_a
    transition_state.source_b = fresh.source_b
    transition_state.duration_str = fresh.duration_str
    transition_state.start_str = fresh.start_str
    transition_state.res_source = fresh.res_source
    transition_state.fps_mode = fresh.fps_mode
    transition_state.quality = fresh.quality
    transition_state.audio_quality = fresh.audio_quality
    transition_state.crf_override = fresh.crf_override
    transition_state.easing = fresh.easing
    transition_state.is_processing = fresh.is_processing
    transition_state.progress = fresh.progress
    transition_state.result = fresh.result
    transition_state.error = fresh.error
    transition_state.message = fresh.message
}
