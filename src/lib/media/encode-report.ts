import { is_chromium } from "../utils/browser-detect"
import type { TransitionVideoConfig } from "./transition-utils"

export interface EffectiveEncodeReport {
    requested: TransitionVideoConfig
    effective: VideoEncoderConfig | null
    fell_back: boolean
    hardware: string
    chromium: boolean
}

type EffectiveWithQuantizer = VideoEncoderConfig & { quantizer?: number | null }

export function capture_encode_report(
    effective: VideoEncoderConfig | null,
    requested: TransitionVideoConfig,
): EffectiveEncodeReport {
    const quantizer = (effective as EffectiveWithQuantizer | null)?.quantizer ?? null
    const fell_back = effective == null || (requested.quantizer != null && quantizer == null)
    return { requested, effective, fell_back, hardware: "no-preference", chromium: is_chromium() }
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
