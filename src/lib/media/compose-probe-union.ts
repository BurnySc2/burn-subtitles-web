import type { ProbeResult } from "./mediabunny-clip"
import type { TransitionAudioBitrateProbe } from "./transition-utils"

export function union_probe_lists(lists: Array<readonly ProbeResult[] | null | undefined>): ProbeResult[] {
    const seen = new Set<ProbeResult>()
    const union: ProbeResult[] = []
    for (const list of lists) {
        if (!list) {
            continue
        }
        for (const probe of list) {
            if (seen.has(probe)) {
                continue
            }
            seen.add(probe)
            union.push(probe)
        }
    }
    return union
}

function is_positive_finite(value: number | null | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function peak_audio_probe(
    probes: readonly ProbeResult[] | null | undefined,
): TransitionAudioBitrateProbe | null {
    if (!probes) {
        return null
    }
    let peak_audio: number | null = null
    let peak_overall: number | null = null
    for (const probe of probes) {
        if (is_positive_finite(probe.audio_bitrate) && (peak_audio === null || probe.audio_bitrate > peak_audio)) {
            peak_audio = probe.audio_bitrate
        }
        if (
            is_positive_finite(probe.overall_bitrate) &&
            (peak_overall === null || probe.overall_bitrate > peak_overall)
        ) {
            peak_overall = probe.overall_bitrate
        }
    }
    if (peak_audio !== null) {
        return { audio_bitrate: peak_audio, overall_bitrate: null }
    }
    if (peak_overall !== null) {
        return { audio_bitrate: peak_overall, overall_bitrate: null }
    }
    return null
}
