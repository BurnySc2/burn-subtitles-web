export type TrimRangeReason = "both-empty" | "no-duration" | "invalid-range"

export type TrimRangeResult = { ok: true; start: number; end: number } | { ok: false; reason: TrimRangeReason }

export function resolve_trim_range(
    data: { start: number | null; end: number | null },
    upstream_duration: number | null,
): TrimRangeResult {
    if (data.start === null && data.end === null) {
        return { ok: false, reason: "both-empty" }
    }
    const start = data.start ?? 0
    if (data.end === null && upstream_duration === null) {
        return { ok: false, reason: "no-duration" }
    }
    const end = data.end ?? (upstream_duration as number)
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return { ok: false, reason: "invalid-range" }
    }
    if (start < 0 || end <= start) {
        return { ok: false, reason: "invalid-range" }
    }
    return { ok: true, start, end }
}

export function parse_trim_field(raw: string): number | null | undefined {
    if (raw.trim() === "") {
        return null
    }
    const value = Number(raw)
    return Number.isFinite(value) ? value : undefined
}
