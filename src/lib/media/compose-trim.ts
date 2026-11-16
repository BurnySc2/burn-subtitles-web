import type { ComposeEdge, ComposeNode } from "./compose-types"
import { ClipError } from "./mediabunny-clip"

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
    let end: number
    if (data.end !== null) {
        end = data.end
    } else if (upstream_duration !== null) {
        end = upstream_duration
    } else {
        return { ok: false, reason: "no-duration" }
    }
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

export function gate_positive(value: number | null): number | null {
    if (value === null || !Number.isFinite(value) || value <= 0) {
        return null
    }
    return value
}

export function node_output_duration(
    id: string,
    by_id: Map<string, ComposeNode>,
    incoming: Map<string, ComposeEdge[]>,
    seen: Set<string>,
): number | null {
    if (seen.has(id)) {
        return null
    }
    const node = by_id.get(id)
    if (!node) {
        return null
    }
    seen.add(id)
    if (node.type === "source") {
        return gate_positive(node.data.probe?.duration ?? null)
    }
    if (node.type === "color") {
        return gate_positive(node.data.duration)
    }
    if (node.type === "trim") {
        const edges = incoming.get(node.id) ?? []
        if (edges.length !== 1) {
            return null
        }
        const up = node_output_duration(edges[0].source, by_id, incoming, seen)
        const resolved = resolve_trim_range(node.data, up)
        if (!resolved.ok) {
            return null
        }
        const own = resolved.end - resolved.start
        if (!Number.isFinite(own) || own <= 0) {
            return null
        }
        return up === null ? own : Math.min(up, own)
    }
    if (
        node.type === "rescale" ||
        node.type === "subtitles" ||
        node.type === "overlay" ||
        node.type === "text" ||
        node.type === "output"
    ) {
        const edges = incoming.get(node.id) ?? []
        if (edges.length !== 1) {
            return null
        }
        return node_output_duration(edges[0].source, by_id, incoming, seen)
    }
    return null
}

export function trim_upstream_duration(
    node_id: string,
    by_id: Map<string, ComposeNode>,
    incoming: Map<string, ComposeEdge[]>,
): number | null {
    const pred = (incoming.get(node_id) ?? [])[0]?.source ?? null
    if (pred === null) {
        return null
    }
    return node_output_duration(pred, by_id, incoming, new Set<string>())
}

export function trim_range_error(reason: "both-empty" | "no-duration" | "invalid-range"): never {
    if (reason === "both-empty") {
        throw new ClipError("FAILED", "Trim needs a start or an end — both empty trims nothing.")
    }
    if (reason === "no-duration") {
        throw new ClipError("FAILED", "Trim end needs an upstream duration or an explicit value.")
    }
    throw new ClipError("FAILED", "Trim end must be larger than start.")
}
