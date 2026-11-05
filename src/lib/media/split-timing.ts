/** Split timing helpers for gapless/overlapping part boundaries. */
export const DEFAULT_GAP_MS = 10

export const GAP_PRESETS = [0, 10, 80]

export const MIN_PART = 0.2

export const MAX_GAP_MS = 500

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
