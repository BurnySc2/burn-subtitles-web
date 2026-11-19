import type { FusedDispatch } from "./compose-fused"
import type { ComposeEdge } from "./compose-types"

export function build_downstream_refcounts(
    edges: ComposeEdge[],
    live_ids: Set<string>,
    canonical_of: (id: string) => string = (id) => id,
): Map<string, number> {
    const consumers = new Map<string, Set<string>>()
    for (const edge of edges) {
        if (!live_ids.has(edge.source) || !live_ids.has(edge.target)) {
            continue
        }
        const producer = canonical_of(edge.source)
        const consumer = canonical_of(edge.target)
        if (producer === consumer) {
            continue
        }
        let seen = consumers.get(producer)
        if (!seen) {
            seen = new Set()
            consumers.set(producer, seen)
        }
        seen.add(consumer)
    }
    const refcounts = new Map<string, number>()
    for (const [producer, seen] of consumers) {
        refcounts.set(producer, seen.size)
    }
    return refcounts
}

export function drain_consumed_predecessors(
    consumed_node_id: string,
    incoming: Map<string, ComposeEdge[]>,
    memo: Map<string, Blob>,
    remaining: Map<string, number>,
    canonical_of: (id: string) => string,
    retain_ids: Set<string>,
): string[] {
    const producers = new Set<string>()
    for (const edge of incoming.get(consumed_node_id) ?? []) {
        producers.add(canonical_of(edge.source))
    }
    const deleted: string[] = []
    for (const producer of producers) {
        const count = Math.max((remaining.get(producer) ?? 0) - 1, 0)
        remaining.set(producer, count)
        if (count > 0 || retain_ids.has(producer)) {
            continue
        }
        for (const key of [...memo.keys()]) {
            if (canonical_of(key) !== producer || retain_ids.has(key)) {
                continue
            }
            memo.delete(key)
            deleted.push(key)
        }
    }
    return deleted
}

export function take_final<T>(memo: Map<string, T>, final_id: string): T | null {
    const final = memo.get(final_id) ?? null
    for (const key of [...memo.keys()]) {
        if (key !== final_id) {
            memo.delete(key)
        }
    }
    return final
}

export function build_fused_canonical(fused_dispatch: Map<string, FusedDispatch>): (id: string) => string {
    const canonical = new Map<string, string>()
    for (const dispatch of fused_dispatch.values()) {
        for (const id of dispatch.fused_ids) {
            if (!canonical.has(id)) {
                canonical.set(id, dispatch.end_id)
            }
        }
    }
    return (id: string) => canonical.get(id) ?? id
}
