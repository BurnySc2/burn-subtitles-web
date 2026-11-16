import { is_chromium } from "../utils/browser-detect"
import type { TransitionVideoConfig } from "./transition-utils"

export interface EffectiveEncodeReport {
    requested: TransitionVideoConfig
    effective: unknown | null
    fell_back: boolean
    hardware: string
    chromium: boolean
}

type EncoderConfigSource = {
    onEncoderConfig?: unknown
}

function read_hook(source: unknown): unknown {
    if (typeof source !== "object" || source === null) {
        return undefined
    }
    return (source as EncoderConfigSource).onEncoderConfig
}

export async function capture_encode_report(
    source: unknown,
    requested: TransitionVideoConfig,
): Promise<EffectiveEncodeReport> {
    const chromium = is_chromium()
    const fallback: EffectiveEncodeReport = {
        requested,
        effective: null,
        fell_back: false,
        hardware: "no-preference",
        chromium,
    }
    try {
        const hook = read_hook(source)
        if (typeof hook !== "function") {
            return fallback
        }
        const effective = await (hook as (requested: TransitionVideoConfig) => unknown).call(source, requested)
        if (effective === undefined || effective === null) {
            return fallback
        }
        return { ...fallback, effective }
    } catch {
        return { ...fallback, fell_back: true }
    }
}
