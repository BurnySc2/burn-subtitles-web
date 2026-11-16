import { is_chromium } from "../utils/browser-detect"
import type { TransitionVideoConfig } from "./transition-utils"

export interface EffectiveEncodeReport {
    requested: TransitionVideoConfig
    effective: VideoEncoderConfig | null
    fell_back: boolean
    hardware: string
    chromium: boolean
}

type EffectiveProbe = VideoEncoderConfig & { avc?: { quantizer?: number | null } }

export function capture_encode_report(
    effective: VideoEncoderConfig | null,
    requested: TransitionVideoConfig,
): EffectiveEncodeReport {
    const probe = effective as EffectiveProbe | null
    const quantizerActive = probe?.bitrateMode === "quantizer" || probe?.avc?.quantizer != null
    const fell_back = effective == null || (requested.quantizer != null && !quantizerActive)
    const hardware = effective?.hardwareAcceleration ?? "no-preference"
    return { requested, effective, fell_back, hardware, chromium: is_chromium() }
}

export function format_encode_badge(report: EffectiveEncodeReport | null): string | null {
    if (report == null) {
        return null
    }
    if (report.fell_back) {
        return `Fell back to ${Math.round(report.requested.bitrate / 1_000_000)}M bitrate`
    }
    if (report.requested.quantizer != null) {
        return `Quantizer active (Q${report.requested.quantizer})`
    }
    return null
}
