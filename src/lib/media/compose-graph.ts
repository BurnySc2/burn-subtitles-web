import type { ComposeEdge, ComposeNode } from "./compose-types"
import { ClipError } from "./mediabunny-clip"

export type ComposeOutputNode = Extract<ComposeNode, { type: "output" }>

export function topo_sort_compose(nodes: ComposeNode[], edges: ComposeEdge[]): string[] {
    const ids = nodes.map((node) => node.id)
    const known = new Set(ids)
    const indegree = new Map<string, number>(ids.map((id) => [id, 0]))
    const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]))
    for (const edge of edges) {
        if (!known.has(edge.source) || !known.has(edge.target)) {
            continue
        }
        outgoing.get(edge.source)?.push(edge.target)
        indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
    }
    const queue = ids.filter((id) => indegree.get(id) === 0)
    const order: string[] = []
    for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head]
        order.push(current)
        for (const next of outgoing.get(current) ?? []) {
            const remaining = (indegree.get(next) ?? 0) - 1
            indegree.set(next, remaining)
            if (remaining === 0) {
                queue.push(next)
            }
        }
    }
    if (order.length !== ids.length) {
        throw new ClipError("INVALID_RANGE", "Composition graph contains a cycle")
    }
    return order
}

export function find_output_node(nodes: ComposeNode[]): ComposeOutputNode | null {
    return (nodes.find((node) => node.type === "output") as ComposeOutputNode | undefined) ?? null
}

function merge_handle_index(handle: string | null): number {
    if (typeof handle !== "string") {
        return Number.MAX_SAFE_INTEGER
    }
    const match = /^in(\d+)$/.exec(handle)
    if (!match) {
        return Number.MAX_SAFE_INTEGER
    }
    return Number(match[1])
}

export function ordered_merge_inputs(node_id: string, edges: ComposeEdge[]): string[] {
    return edges
        .filter((edge) => edge.target === node_id)
        .slice()
        .sort((a, b) => {
            const index_a = merge_handle_index(a.targetHandle)
            const index_b = merge_handle_index(b.targetHandle)
            if (index_a !== index_b) {
                return index_a - index_b
            }
            return a.source < b.source ? -1 : a.source > b.source ? 1 : 0
        })
        .map((edge) => edge.source)
}

export function upstream_of(target_id: string, nodes: ComposeNode[], edges: ComposeEdge[]): string[] {
    const known = new Set(nodes.map((node) => node.id))
    if (!known.has(target_id)) {
        return []
    }
    const incoming = new Map<string, string[]>()
    for (const edge of edges) {
        if (!known.has(edge.source) || !known.has(edge.target)) {
            continue
        }
        const list = incoming.get(edge.target) ?? []
        list.push(edge.source)
        incoming.set(edge.target, list)
    }
    const seen = new Set<string>([target_id])
    const stack = [target_id]
    while (stack.length > 0) {
        const current = stack.pop() as string
        for (const prev of incoming.get(current) ?? []) {
            if (!seen.has(prev)) {
                seen.add(prev)
                stack.push(prev)
            }
        }
    }
    seen.delete(target_id)
    if (seen.size === 0) {
        return []
    }
    return topo_sort_compose(nodes, edges).filter((id) => seen.has(id))
}
