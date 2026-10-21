import { topo_sort_compose } from "./compose-graph"
import { validate_srt } from "./compose-subtitles"
import type { ComposeEdge, ComposeNode, ValidationIssue } from "./compose-types"
import { format_timecode, validate_range } from "./timecode"

function upstream_duration(
    start_id: string,
    by_id: Map<string, ComposeNode>,
    incoming: Map<string, ComposeEdge[]>,
): number | null {
    const seen = new Set([start_id])
    let current = start_id
    while (true) {
        const preds = (incoming.get(current) ?? []).map((edge) => edge.source)
        if (preds.length !== 1) {
            return null
        }
        const next = preds[0]
        if (seen.has(next)) {
            return null
        }
        seen.add(next)
        const node = by_id.get(next)
        if (!node) {
            return null
        }
        if (node.type === "source") {
            return node.data.probe?.duration ?? null
        }
        if (node.type === "trim" || node.type === "subtitles") {
            current = next
            continue
        }
        return null
    }
}

export function validate_compose(nodes: ComposeNode[], edges: ComposeEdge[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const by_id = new Map(nodes.map((node) => [node.id, node]))
    const incoming = new Map<string, ComposeEdge[]>()
    const outgoing = new Map<string, ComposeEdge[]>()
    for (const node of nodes) {
        incoming.set(node.id, [])
        outgoing.set(node.id, [])
    }
    for (const edge of edges) {
        if (incoming.has(edge.target)) {
            incoming.get(edge.target)?.push(edge)
        }
        if (outgoing.has(edge.source)) {
            outgoing.get(edge.source)?.push(edge)
        }
    }
    const ins = (id: string): ComposeEdge[] => incoming.get(id) ?? []
    const outs = (id: string): ComposeEdge[] => outgoing.get(id) ?? []

    const outputs = nodes.filter((node) => node.type === "output")
    if (outputs.length !== 1) {
        issues.push({
            node_id: null,
            field: "output",
            message: `Expected exactly 1 output node, found ${outputs.length}`,
        })
    }

    for (const node of nodes) {
        const count = ins(node.id).length
        switch (node.type) {
            case "source":
                if (count > 0) {
                    issues.push({ node_id: node.id, field: "input", message: "Source node must have no inputs" })
                }
                break
            case "trim":
                if (count !== 1) {
                    issues.push({
                        node_id: node.id,
                        field: "input",
                        message: "Trim node must have exactly 1 input",
                    })
                }
                break
            case "subtitles":
                if (count !== 1) {
                    issues.push({
                        node_id: node.id,
                        field: "input",
                        message: "Subtitles node must have exactly 1 input",
                    })
                }
                break
            case "transition":
                if (count !== 2) {
                    issues.push({
                        node_id: node.id,
                        field: "input",
                        message: "Transition node must have exactly 2 inputs",
                    })
                } else {
                    const handles = ins(node.id).map((edge) => edge.targetHandle)
                    if (!handles.includes("a") || !handles.includes("b")) {
                        issues.push({
                            node_id: node.id,
                            field: "input",
                            message: 'Transition node must have inputs "a" and "b"',
                        })
                    }
                }
                break
            case "output":
                if (count !== 1) {
                    issues.push({
                        node_id: node.id,
                        field: "input",
                        message: "Output node must have exactly 1 input",
                    })
                }
                break
        }
    }

    if (outputs.length >= 1) {
        const reached = new Set<string>()
        const stack = outputs.map((node) => node.id)
        while (stack.length > 0) {
            const current = stack.pop() as string
            if (reached.has(current)) {
                continue
            }
            reached.add(current)
            for (const edge of ins(current)) {
                if (by_id.has(edge.source) && !reached.has(edge.source)) {
                    stack.push(edge.source)
                }
            }
        }
        for (const node of nodes) {
            if (!reached.has(node.id)) {
                issues.push({ node_id: node.id, field: "connection", message: "Node does not reach the output" })
            }
        }
    }

    for (const node of nodes) {
        if (node.type === "source" && !node.data.file) {
            issues.push({ node_id: node.id, field: "file", message: "Source file is required" })
        }
        if (node.type === "trim") {
            const { start, end } = node.data
            const check = validate_range(format_timecode(start), format_timecode(end))
            if (check.start_error) {
                issues.push({ node_id: node.id, field: "start", message: check.start_error })
            }
            if (check.end_error) {
                issues.push({ node_id: node.id, field: "end", message: check.end_error })
            }
            if (check.range_error) {
                issues.push({ node_id: node.id, field: "range", message: check.range_error })
            }
            const duration = upstream_duration(node.id, by_id, incoming)
            if (duration !== null) {
                if (start < 0) {
                    issues.push({ node_id: node.id, field: "start", message: "Start time must not be negative" })
                }
                if (end > duration) {
                    issues.push({
                        node_id: node.id,
                        field: "end",
                        message: `End time exceeds source duration (${format_timecode(duration)})`,
                    })
                }
            }
        } else if (node.type === "transition") {
            if (!(node.data.duration > 0)) {
                issues.push({
                    node_id: node.id,
                    field: "duration",
                    message: "Transition duration must be greater than 0",
                })
            }
        } else if (node.type === "subtitles") {
            const wired = ins(node.id).length > 0 || outs(node.id).length > 0
            if (wired) {
                const content = node.data.content
                if (content === null || content.trim() === "") {
                    if (!node.data.file) {
                        issues.push({
                            node_id: node.id,
                            field: "content",
                            message: "Subtitle content must not be empty",
                        })
                    }
                } else {
                    const check = validate_srt(content)
                    for (const error of check.errors) {
                        issues.push({ node_id: node.id, field: "content", message: error })
                    }
                }
            }
        }
    }

    try {
        topo_sort_compose(nodes, edges)
    } catch {
        issues.push({ node_id: null, field: "cycle", message: "Composition graph contains a cycle" })
    }

    return issues
}
