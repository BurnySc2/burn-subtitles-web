import { is_chromium } from "../utils/browser-detect"
import { is_font_available } from "./compose-font-library"
import { topo_sort_compose } from "./compose-graph"
import { node_output_duration, pred_by_handle, resolve_trim_range, trim_upstream_duration } from "./compose-trim"
import type { ComposeEdge, ComposeNode, TextItem, ValidationIssue } from "./compose-types"
import { MAX_TEXT_ITEMS, TEXT_ANCHORS } from "./compose-types"
import { format_timecode } from "./timecode"
import { parse_crf_override, TRANSITION_AUDIO_MODE_DEFAULT, TRANSITION_AUDIO_MODES } from "./transition-utils"

export { compose_node_durations } from "./compose-trim"

export function validate_compose(
    nodes: ComposeNode[],
    edges: ComposeEdge[],
    is_chromium_browser: boolean = is_chromium(),
): ValidationIssue[] {
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
            case "text":
                if (count !== 1) {
                    issues.push({
                        node_id: node.id,
                        field: "input",
                        message: "Text node must have exactly 1 input",
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

    const duration_memo = new Map<string, number | null>()
    for (const node of nodes) {
        if (node.type === "source" && !node.data.file) {
            issues.push({ node_id: node.id, field: "file", message: "Source file is required" })
        }
        if (node.type === "trim") {
            const duration = trim_upstream_duration(node.id, by_id, incoming, duration_memo)
            const resolved = resolve_trim_range(node.data, duration)
            if (!resolved.ok) {
                if (resolved.reason === "both-empty") {
                    issues.push({
                        node_id: node.id,
                        field: "range",
                        message: "Trim needs a start or an end — both empty trims nothing.",
                    })
                } else if (resolved.reason === "no-duration") {
                    const pred_edges = incoming.get(node.id) ?? []
                    const pred = pred_edges.length === 1 ? by_id.get(pred_edges[0].source) : undefined
                    // WHY skip pending/missing upstream: probe resolves async, missing file flagged on source
                    if (pred?.type === "source" && (pred.data.file === null || pred.data.probe === null)) {
                        continue
                    }
                    issues.push({
                        node_id: node.id,
                        field: "end",
                        message: "Trim end needs an upstream duration or an explicit value.",
                    })
                } else {
                    issues.push({
                        node_id: node.id,
                        field: "end",
                        message: "Trim end must be larger than start.",
                    })
                }
                continue
            }
            const { start, end } = resolved
            if (duration !== null) {
                if (start >= duration) {
                    issues.push({
                        node_id: node.id,
                        field: "start",
                        message: `Trim start exceeds input duration (${format_timecode(duration)}).`,
                    })
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
            const start = node.data.start
            const transition_duration = node.data.duration
            if (!Number.isFinite(start) || start < 0) {
                issues.push({
                    node_id: node.id,
                    field: "start",
                    message: "Transition start must not be negative.",
                })
            }
            if (!(transition_duration > 0)) {
                issues.push({
                    node_id: node.id,
                    field: "duration",
                    message: "Transition duration must be greater than 0",
                })
            }
            const pred_a = pred_by_handle(node.id, "a", incoming)
            const duration_a =
                pred_a === null ? null : node_output_duration(pred_a, by_id, incoming, duration_memo, new Set<string>())
            if (
                duration_a !== null &&
                Number.isFinite(start) &&
                Number.isFinite(transition_duration) &&
                start + transition_duration > duration_a
            ) {
                issues.push({
                    node_id: node.id,
                    field: "start",
                    message: `Transition start plus duration exceeds source A duration (${format_timecode(duration_a)}).`,
                })
            }
            const pred_b = pred_by_handle(node.id, "b", incoming)
            const len_b =
                pred_b === null ? null : node_output_duration(pred_b, by_id, incoming, duration_memo, new Set<string>())
            if (len_b !== null && Number.isFinite(transition_duration) && transition_duration > len_b) {
                issues.push({
                    node_id: node.id,
                    field: "duration",
                    message: `Transition duration exceeds source B duration (${format_timecode(len_b)}).`,
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
                const subtitle_file = node.data.file
                if (!subtitle_file) {
                    issues.push({
                        node_id: node.id,
                        field: "file",
                        message: "SRT file is required — attach an .srt file.",
                    })
                } else {
                    if (!/\.srt$/i.test(subtitle_file.name)) {
                        issues.push({
                            node_id: node.id,
                            field: "file",
                            message: "Subtitle file must be an .srt file",
                        })
                    }
                    if (subtitle_file.size > 5 * 1024 * 1024) {
                        issues.push({
                            node_id: node.id,
                            field: "file",
                            message: "Subtitle file must not exceed 5 MiB",
                        })
                    }
                }
                for (const field of ["text_color", "stroke_color"] as const) {
                    const value = node.data[field]
                    if (value !== undefined && value !== null && !/^#[0-9a-fA-F]{6}$/.test(value)) {
                        issues.push({
                            node_id: node.id,
                            field,
                            message: `Subtitle ${field} must be a hex color like #ffffff`,
                        })
                    }
                }
                const range_checks = [
                    { field: "font_size", raw: node.data.font_size, min: 8, max: 160 },
                    { field: "outline_size", raw: node.data.outline_size, min: 0, max: 10 },
                    { field: "shadow_size", raw: node.data.shadow_size, min: 0, max: 10 },
                    { field: "horizontal_margin", raw: node.data.horizontal_margin, min: 0, max: 2000 },
                    { field: "vertical_offset", raw: node.data.vertical_offset, min: 0, max: 2000 },
                ] as const
                for (const check of range_checks) {
                    if (
                        check.raw !== undefined &&
                        check.raw !== null &&
                        Number.isFinite(check.raw) &&
                        (check.raw < check.min || check.raw > check.max)
                    ) {
                        issues.push({
                            node_id: node.id,
                            field: check.field,
                            message: `Subtitle ${check.field} must be between ${check.min} and ${check.max}`,
                        })
                    }
                }
                const font_family = node.data.font_family
                if (typeof font_family === "string" && font_family.length > 200) {
                    issues.push({
                        node_id: node.id,
                        field: "font_family",
                        message: "Subtitle font_family must be at most 200 characters",
                    })
                } else if (
                    typeof font_family === "string" &&
                    font_family.trim() !== "" &&
                    !is_font_available(font_family.trim())
                ) {
                    issues.push({
                        node_id: node.id,
                        field: "font_family",
                        message: "Subtitle font is not available — load it in the font library",
                    })
                }
                if (!is_chromium_browser) {
                    issues.push({
                        node_id: node.id,
                        field: "mode",
                        message: "Burn mode subtitles render best in a Chromium browser such as Chrome or Edge",
                    })
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
            if (!Number.isFinite(offset_x)) {
                issues.push({
                    node_id: node.id,
                    field: "offset_x",
                    message: "Overlay offset_x must be a finite number",
                })
            }
            if (!Number.isFinite(offset_y)) {
                issues.push({
                    node_id: node.id,
                    field: "offset_y",
                    message: "Overlay offset_y must be a finite number",
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
            const duration = trim_upstream_duration(node.id, by_id, incoming, duration_memo)
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
        } else if (node.type === "text") {
            const wired = ins(node.id).length > 0 || outs(node.id).length > 0
            const items: TextItem[] = Array.isArray(node.data.items) ? node.data.items : []
            if (wired && items.length < 1) {
                issues.push({ node_id: node.id, field: "items", message: "Text node must have at least 1 item" })
            }
            if (items.length > MAX_TEXT_ITEMS) {
                issues.push({
                    node_id: node.id,
                    field: "items",
                    message: `Text node must have at most ${MAX_TEXT_ITEMS} items`,
                })
            }
            const duration = trim_upstream_duration(node.id, by_id, incoming, duration_memo)
            for (const [index, item] of items.entries()) {
                const prefix = `items[${index}]`
                if (typeof item.text !== "string" || item.text.trim() === "") {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.text`,
                        message: "Text item text must not be empty",
                    })
                } else if (item.text.length > 2000) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.text`,
                        message: "Text item text must be at most 2000 characters",
                    })
                }
                if (!Number.isFinite(item.size_start) || item.size_start <= 0 || item.size_start > 1000) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.size_start`,
                        message: "Text item size_start must be greater than 0 and at most 1000",
                    })
                }
                if (!Number.isFinite(item.size_end) || item.size_end <= 0 || item.size_end > 1000) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.size_end`,
                        message: "Text item size_end must be greater than 0 and at most 1000",
                    })
                }
                if (typeof item.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(item.color)) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.color`,
                        message: "Text item color must be a hex string like #000000",
                    })
                }
                if (!Number.isFinite(item.opacity) || item.opacity < 0 || item.opacity > 1) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.opacity`,
                        message: "Text item opacity must be between 0 and 1",
                    })
                }
                if (!Number.isFinite(item.offset_x)) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.offset_x`,
                        message: "Text item offset_x must be a finite number",
                    })
                }
                if (!Number.isFinite(item.offset_y)) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.offset_y`,
                        message: "Text item offset_y must be a finite number",
                    })
                }
                if (item.align !== "left" && item.align !== "center" && item.align !== "right") {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.align`,
                        message: 'Text item align must be one of "left", "center" or "right"',
                    })
                }
                if (typeof item.font !== "string" || item.font.trim() === "") {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.font`,
                        message: "Text item font must not be empty",
                    })
                } else if (item.font.length > 200) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.font`,
                        message: "Text item font must be at most 200 characters",
                    })
                }
                if (!TEXT_ANCHORS.includes(item.anchor)) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.anchor`,
                        message:
                            'Text item anchor must be one of "top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center" or "bottom-right"',
                    })
                }
                if (item.max_width !== null && (!Number.isFinite(item.max_width) || item.max_width <= 0)) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.max_width`,
                        message: "Text item max_width must be null or greater than 0",
                    })
                }
                if (!Number.isFinite(item.show_start) || item.show_start < 0) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.show_start`,
                        message: "Text item show_start must not be negative",
                    })
                }
                if (item.show_end !== null && (!Number.isFinite(item.show_end) || !(item.show_end > item.show_start))) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.show_end`,
                        message: "Text item show_end must be greater than show_start",
                    })
                }
                if (!Number.isFinite(item.fade_in) || item.fade_in < 0) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.fade_in`,
                        message: "Text item fade_in must not be negative",
                    })
                }
                if (!Number.isFinite(item.fade_out) || item.fade_out < 0) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.fade_out`,
                        message: "Text item fade_out must not be negative",
                    })
                }
                const visible_window = (item.show_end ?? duration ?? Number.POSITIVE_INFINITY) - item.show_start
                if (
                    Number.isFinite(visible_window) &&
                    Number.isFinite(item.fade_in) &&
                    Number.isFinite(item.fade_out) &&
                    item.fade_in + item.fade_out > visible_window
                ) {
                    issues.push({
                        node_id: node.id,
                        field: `${prefix}.fade_out`,
                        message: "Text item fade_in plus fade_out must not exceed the visible window",
                    })
                }
                if (duration !== null) {
                    if (Number.isFinite(item.show_start) && item.show_start > duration) {
                        issues.push({
                            node_id: node.id,
                            field: `${prefix}.show_start`,
                            message: `Text item show_start exceeds source duration (${format_timecode(duration)})`,
                        })
                    }
                    if (item.show_end !== null && Number.isFinite(item.show_end) && item.show_end > duration + 1e-6) {
                        issues.push({
                            node_id: node.id,
                            field: `${prefix}.show_end`,
                            message: `Text item show_end exceeds source duration (${format_timecode(duration)})`,
                        })
                    }
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
