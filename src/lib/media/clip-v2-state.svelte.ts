import type { ProbeResult } from "./mediabunny-clip"

export interface ClipSource {
    file: File
    url: string
    probe: ProbeResult | null
}

export interface ClipResult {
    url: string
    mime: string
    ext: string
    size_bytes: number
    duration: string
}

export interface ClipV2State {
    source: ClipSource | null
    start_str: string
    end_str: string
    is_processing: boolean
    result: ClipResult | null
    error: string | null
    message: string | null
}

function initial_state(): ClipV2State {
    return {
        source: null,
        start_str: "00:00:00.000",
        end_str: "",
        is_processing: false,
        result: null,
        error: null,
        message: null,
    }
}

export const clip_v2_state: ClipV2State = $state(initial_state())

export function reset_output(): void {
    if (clip_v2_state.result) {
        URL.revokeObjectURL(clip_v2_state.result.url)
    }
    clip_v2_state.result = null
    clip_v2_state.error = null
    clip_v2_state.message = null
}

export function revoke_all(): void {
    if (clip_v2_state.source) {
        URL.revokeObjectURL(clip_v2_state.source.url)
    }
    if (clip_v2_state.result) {
        URL.revokeObjectURL(clip_v2_state.result.url)
    }
    const fresh = initial_state()
    clip_v2_state.source = fresh.source
    clip_v2_state.start_str = fresh.start_str
    clip_v2_state.end_str = fresh.end_str
    clip_v2_state.is_processing = fresh.is_processing
    clip_v2_state.result = fresh.result
    clip_v2_state.error = fresh.error
    clip_v2_state.message = fresh.message
}
