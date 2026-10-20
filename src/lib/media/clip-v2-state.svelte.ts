import type { ProbeResult } from "./mediabunny-clip"

export interface ClipV2State {
    source_file: File | null
    source_url: string | null
    duration: number | null
    has_video: boolean
    has_audio: boolean
    media_details: ProbeResult | null
    start_str: string
    end_str: string
    is_processing: boolean
    result_url: string | null
    result_mime: string | null
    error: string | null
    message: string | null
}

function initial_state(): ClipV2State {
    return {
        source_file: null,
        source_url: null,
        duration: null,
        has_video: false,
        has_audio: false,
        media_details: null,
        start_str: "00:00:00.000",
        end_str: "",
        is_processing: false,
        result_url: null,
        result_mime: null,
        error: null,
        message: null,
    }
}

export const clip_v2_state: ClipV2State = $state(initial_state())

export function reset_output(): void {
    if (clip_v2_state.result_url) {
        URL.revokeObjectURL(clip_v2_state.result_url)
    }
    clip_v2_state.result_url = null
    clip_v2_state.result_mime = null
    clip_v2_state.error = null
    clip_v2_state.message = null
}

export function revoke_all(): void {
    if (clip_v2_state.source_url) {
        URL.revokeObjectURL(clip_v2_state.source_url)
    }
    if (clip_v2_state.result_url) {
        URL.revokeObjectURL(clip_v2_state.result_url)
    }
    const fresh = initial_state()
    clip_v2_state.source_file = fresh.source_file
    clip_v2_state.source_url = fresh.source_url
    clip_v2_state.duration = fresh.duration
    clip_v2_state.has_video = fresh.has_video
    clip_v2_state.has_audio = fresh.has_audio
    clip_v2_state.media_details = fresh.media_details
    clip_v2_state.start_str = fresh.start_str
    clip_v2_state.end_str = fresh.end_str
    clip_v2_state.is_processing = fresh.is_processing
    clip_v2_state.result_url = fresh.result_url
    clip_v2_state.result_mime = fresh.result_mime
    clip_v2_state.error = fresh.error
    clip_v2_state.message = fresh.message
}
