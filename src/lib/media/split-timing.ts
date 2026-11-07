/** Split timing helpers for gapless/overlapping part boundaries. */
export const DEFAULT_GAP_MS = 10

export const MIN_PART = 0.2

export const MAX_GAP_MS = 500

export type BalancePreset = "equal" | "proportional" | "long_boost"

export const LONG_BOOST_GAMMA = 2

export const BALANCE_PRESETS: Array<{ id: BalancePreset; label: string; hint: string }> = [
    { id: "equal", label: "Equal", hint: "Both halves get equal time" },
    { id: "proportional", label: "Proportional", hint: "Time matches text length" },
    { id: "long_boost", label: "Long-first boost", hint: "Longer half gets extra time" },
]

/** Power-weighted balance curve; r is the proportional text share. */
export function balance_ratio(r: number, gamma: number = 1): number {
    const clamped = Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0.5
    if (clamped === 0.5) {
        return 0.5
    }
    const g = Number.isFinite(gamma) ? Math.min(3, Math.max(0.25, gamma)) : 1
    const rg = clamped ** g
    return rg / (rg + (1 - clamped) ** g)
}

/** Map a text share to an effective split ratio for the given preset. */
export function balance_effective_ratio(r: number, preset: BalancePreset): number {
    if (preset === "equal") {
        return 0.5
    }
    if (preset === "long_boost") {
        return balance_ratio(r, LONG_BOOST_GAMMA)
    }
    return Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0.5
}

/** Quantize seconds to centisecond precision. */
export function quantize_cs(x: number): number {
    return Math.round(x * 100) / 100
}

/** Clamp gap to 0..MAX_GAP_MS, falling back to DEFAULT_GAP_MS when non-finite. */
export function clamp_gap(gap_ms: number): number {
    if (!Number.isFinite(gap_ms)) {
        return DEFAULT_GAP_MS
    }
    return Math.min(MAX_GAP_MS, Math.max(0, gap_ms))
}

/**
 * Split [start, end] at ratio with a symmetric gap.
 * Returns end_a === start_b when duration cannot fit gap + 2 * MIN_PART;
 * caller must then fall back to unsplit.
 */
export function split_times(
    start: number,
    end: number,
    ratio: number,
    gap_ms: number = DEFAULT_GAP_MS,
): { end_a: number; start_b: number } {
    const dur = end - start
    const mid = start + dur * ratio
    const gap_s = clamp_gap(gap_ms) / 1000
    if (dur <= gap_s + 2 * MIN_PART) {
        const at = quantize_cs(mid)
        return { end_a: at, start_b: at }
    }
    return { end_a: quantize_cs(mid - gap_s / 2), start_b: quantize_cs(mid + gap_s / 2) }
}
