import { topo_sort_compose } from "./compose-graph"
import { validate_srt } from "./compose-subtitles"
import type { ComposeEdge, ComposeNode, ValidationIssue } from "./compose-types"
import { format_timecode, validate_range } from "./timecode"
import { parse_crf_override, TRANSITION_AUDIO_MODE_DEFAULT, TRANSITION_AUDIO_MODES } from "./transition-utils"

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
        if (node.type === "color") {
            return node.data.duration
        }
        if (node.type === "trim" || node.type === "rescale" || node.type === "subtitles" || node.type === "overlay") {
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

    const seen_connections = new Set<string>()
    for (const edge of edges) {
        const key = `${edge.source}|${edge.sourceHandle ?? ""}|${edge.target}|${edge.targetHandle ?? ""}`
        if (seen_connections.has(key)) {
            issues.push({
                node_id: edge.target,
                field: "connection",
                message: `Duplicate connection from "${edge.source}" — remove the extra edge`,
            })
        } else {
            seen_connections.add(key)
        }
    }

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
            case "color":
                if (count > 0) {
                    issues.push({ node_id: node.id, field: "input", message: "Color node must have no inputs" })
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
            // WHY overlay arity lives in the per-node detail branch below (single check avoids duplicate issues)
            case "rescale":
                if (count !== 1) {
                    issues.push({
                        node_id: node.id,
                        field: "input",
                        message: "Rescale node must have exactly 1 input",
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
            case "merge": {
                const incoming = ins(node.id)
                if (incoming.length < 2) {
                    issues.push({
                        node_id: node.id,
                        field: "input",
                        message: "Merge node must have at least 2 inputs",
                    })
                    break
                }
                const handles = incoming.map((edge) => edge.targetHandle)
                if (!handles.every((handle) => typeof handle === "string" && /^in\d+$/.test(handle))) {
                    issues.push({
                        node_id: node.id,
                        field: "input",
                        message: 'Merge node inputs must be "in0", "in1", ...',
                    })
                    break
                }
                if (new Set(handles).size !== handles.length) {
                    issues.push({
                        node_id: node.id,
                        field: "input",
                        message: "Merge node inputs must use distinct handles",
                    })
                    break
                }
                const capacity = node.data.input_count
                for (const handle of handles) {
                    const index = Number((handle as string).slice(2))
                    if (!Number.isInteger(index) || index < 0 || index >= capacity) {
                        issues.push({
                            node_id: node.id,
                            field: "input",
                            message: `Merge input "${handle}" is outside input_count ${capacity}`,
                        })
                        break
                    }
                }
                break
            }
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
            const audio_mode = node.data.audio_mode ?? TRANSITION_AUDIO_MODE_DEFAULT
            if (!TRANSITION_AUDIO_MODES.includes(audio_mode)) {
                issues.push({
                    node_id: node.id,
                    field: "audio_mode",
                    message: "Unknown transition audio mode.",
                })
            }
        } else if (node.type === "output") {
            for (const dimension of ["width", "height"] as const) {
                const value = node.data[dimension]
                if (!Number.isInteger(value) || value <= 0 || value > 7680 || value % 2 !== 0) {
                    issues.push({
                        node_id: node.id,
                        field: dimension,
                        message: `Output ${dimension} must be a positive even integer up to 7680`,
                    })
                }
            }
            if (!Number.isFinite(node.data.fps) || node.data.fps < 1 || node.data.fps > 120) {
                issues.push({ node_id: node.id, field: "fps", message: "Output fps must be from 1 to 120" })
            }
            const audio_quality = node.data.audio_quality ?? "source-max"
            if (
                audio_quality !== "96k" &&
                audio_quality !== "128k" &&
                audio_quality !== "192k" &&
                audio_quality !== "256k" &&
                audio_quality !== "320k" &&
                audio_quality !== "source-max"
            ) {
                issues.push({
                    node_id: node.id,
                    field: "audio_quality",
                    message: "Unknown output audio quality.",
                })
            }
            try {
                parse_crf_override(node.data.crf ?? null)
            } catch {
                issues.push({
                    node_id: node.id,
                    field: "crf",
                    message: "CRF must be a number from 0 to 51.",
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
        } else if (node.type === "overlay") {
            if (ins(node.id).length !== 1) {
                issues.push({
                    node_id: node.id,
                    field: "input",
                    message: "Overlay node must have exactly 1 input",
                })
            }
            const wired = ins(node.id).length > 0 || outs(node.id).length > 0
            if (wired && node.data.image == null) {
                issues.push({ node_id: node.id, field: "image", message: "Overlay image is required" })
            }
            const { scale, opacity, offset_x, offset_y, show_start, show_end } = node.data
            if (!Number.isFinite(scale) || scale < 1 || scale > 100) {
                issues.push({
                    node_id: node.id,
                    field: "scale",
                    message: "Overlay scale must be between 1 and 100",
                })
            }
            if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
                issues.push({
                    node_id: node.id,
                    field: "opacity",
                    message: "Overlay opacity must be between 0 and 1",
                })
            }
            if (!Number.isFinite(offset_x) || offset_x < 0) {
                issues.push({
                    node_id: node.id,
                    field: "offset_x",
                    message: "Overlay offset_x must not be negative",
                })
            }
            if (!Number.isFinite(offset_y) || offset_y < 0) {
                issues.push({
                    node_id: node.id,
                    field: "offset_y",
                    message: "Overlay offset_y must not be negative",
                })
            }
            if (!Number.isFinite(show_start) || show_start < 0) {
                issues.push({
                    node_id: node.id,
                    field: "show_start",
                    message: "Overlay show_start must not be negative",
                })
            }
            if (show_end !== null && (!Number.isFinite(show_end) || !(show_end > show_start))) {
                issues.push({
                    node_id: node.id,
                    field: "show_end",
                    message: "Overlay show_end must be greater than show_start",
                })
            }
            const duration = upstream_duration(node.id, by_id, incoming)
            if (duration !== null) {
                if (Number.isFinite(show_start) && show_start > duration) {
                    issues.push({
                        node_id: node.id,
                        field: "show_start",
                        message: `Show start exceeds source duration (${format_timecode(duration)})`,
                    })
                }
                if (show_end !== null && Number.isFinite(show_end) && show_end > duration + 1e-6) {
                    issues.push({
                        node_id: node.id,
                        field: "show_end",
                        message: `Show end exceeds source duration (${format_timecode(duration)})`,
                    })
                }
            }
        } else if (node.type === "color") {
            if (!/^#[0-9a-fA-F]{6}$/.test(node.data.color)) {
                issues.push({ node_id: node.id, field: "color", message: "Color must be a hex string like #000000" })
            }
            if (!Number.isFinite(node.data.duration) || node.data.duration <= 0 || node.data.duration > 3600) {
                issues.push({
                    node_id: node.id,
                    field: "duration",
                    message: "Color duration must be greater than 0 and at most 3600",
                })
            }
        } else if (node.type === "rescale") {
            for (const dimension of ["width", "height"] as const) {
                const value = node.data[dimension]
                if (!Number.isInteger(value) || value <= 0 || value > 7680 || value % 2 !== 0) {
                    issues.push({
                        node_id: node.id,
                        field: dimension,
                        message: `Rescale ${dimension} must be a positive even integer up to 7680`,
                    })
                }
            }
            const fps = node.data.fps
            if (fps !== null && (!Number.isFinite(fps) || fps < 1 || fps > 120)) {
                issues.push({ node_id: node.id, field: "fps", message: "Rescale fps must be null or from 1 to 120" })
            }
            if (node.data.fit !== "contain") {
                issues.push({ node_id: node.id, field: "fit", message: 'Rescale fit must be "contain"' })
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
