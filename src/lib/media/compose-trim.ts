import type { ComposeEdge, ComposeNode } from "./compose-types"
import { ClipError } from "./mediabunny-clip"
import { total_transition_duration } from "./transition-utils"

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

function sole_pred(id: string, incoming: Map<string, ComposeEdge[]>): string | null {
    const edges = incoming.get(id) ?? []
    if (edges.length !== 1) {
        return null
    }
    return edges[0].source
}

export function pred_by_handle(id: string, handle: string, incoming: Map<string, ComposeEdge[]>): string | null {
    const matches = (incoming.get(id) ?? []).filter((edge) => edge.targetHandle === handle)
    if (matches.length !== 1) {
        return null
    }
    return matches[0].source
}

export function node_output_duration(
    id: string,
    by_id: Map<string, ComposeNode>,
    incoming: Map<string, ComposeEdge[]>,
    memo: Map<string, number | null>,
    seen: Set<string>,
): number | null {
    if (memo.has(id)) {
        return memo.get(id) ?? null
    }
    if (seen.has(id)) {
        return null
    }
    const node = by_id.get(id)
    if (!node) {
        return null
    }
    seen.add(id)
    let result: number | null = null
    if (node.type === "source") {
        result = gate_positive(node.data.probe?.duration ?? null)
    } else if (node.type === "color") {
        result = gate_positive(node.data.duration)
    } else if (node.type === "trim") {
        const pred = sole_pred(node.id, incoming)
        if (pred !== null) {
            const up = node_output_duration(pred, by_id, incoming, memo, seen)
            const resolved = resolve_trim_range(node.data, up)
            if (resolved.ok) {
                const own = resolved.end - resolved.start
                result = gate_positive(up === null ? own : Math.min(up, own))
            }
        }
    } else if (
        node.type === "rescale" ||
        node.type === "subtitles" ||
        node.type === "overlay" ||
        node.type === "output" ||
        node.type === "text"
    ) {
        const pred = sole_pred(node.id, incoming)
        if (pred !== null) {
            result = node_output_duration(pred, by_id, incoming, memo, seen)
        }
    } else if (node.type === "transition") {
        const pred_a = pred_by_handle(node.id, "a", incoming)
        const pred_b = pred_by_handle(node.id, "b", incoming)
        const start_a = node.data.start
        if (pred_a !== null && pred_b !== null && Number.isFinite(start_a) && start_a >= 0) {
            const len_b = node_output_duration(pred_b, by_id, incoming, memo, seen)
            if (len_b !== null && Number.isFinite(len_b) && len_b > 0) {
                result = gate_positive(total_transition_duration(start_a, len_b))
            }
        }
    } else if (node.type === "merge") {
        const edges = incoming.get(node.id) ?? []
        const handles = edges.map((edge) => edge.targetHandle)
        if (
            edges.length >= 2 &&
            handles.every((handle) => typeof handle === "string" && /^in\d+$/.test(handle)) &&
            new Set(handles).size === handles.length
        ) {
            let sum = 0
            let ok = true
            for (const edge of edges) {
                const part = node_output_duration(edge.source, by_id, incoming, memo, seen)
                if (part === null) {
                    ok = false
                    break
                }
                sum += part
            }
            if (ok) {
                result = gate_positive(sum)
            }
        }
    }
    memo.set(id, result)
    seen.delete(id)
    return result
}

export function compose_node_durations(nodes: ComposeNode[], edges: ComposeEdge[]): Map<string, number | null> {
    const by_id = new Map(nodes.map((node) => [node.id, node]))
    const incoming = new Map<string, ComposeEdge[]>()
    for (const node of nodes) {
        incoming.set(node.id, [])
    }
    for (const edge of edges) {
        if (incoming.has(edge.target)) {
            incoming.get(edge.target)?.push(edge)
        }
    }
    const duration_memo = new Map<string, number | null>()
    for (const node of nodes) {
        node_output_duration(node.id, by_id, incoming, duration_memo, new Set<string>())
    }
    return duration_memo
}

export function trim_upstream_duration(
    node_id: string,
    by_id: Map<string, ComposeNode>,
    incoming: Map<string, ComposeEdge[]>,
    memo: Map<string, number | null> = new Map<string, number | null>(),
): number | null {
    const pred = sole_pred(node_id, incoming)
    if (pred === null) {
        return null
    }
    return node_output_duration(pred, by_id, incoming, memo, new Set<string>())
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
