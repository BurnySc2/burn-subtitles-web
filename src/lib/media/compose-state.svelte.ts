import type { ComposeEdge, ComposeNode, ValidationIssue } from "./compose-types"
import { validate_compose } from "./compose-validation"
import type { ProbeResult } from "./mediabunny-clip"
import {
    parse_crf_override,
    TRANSITION_AUDIO_MODES,
    TRANSITION_AUDIO_MODE_DEFAULT,
    type TransitionAudioMode,
} from "./transition-utils"

export type ComposeRunStatus = "idle" | "running" | "done" | "error"

export interface ComposeResult {
    url: string
    mime: string
    ext: string
    sidecar_url: string | null
}

export interface ComposeState {
    nodes: ComposeNode[]
    edges: ComposeEdge[]
    selected_id: string | null
    selected_edge_id: string | null
    run_status: ComposeRunStatus
    run_progress: number
    run_error: string | null
    result: ComposeResult | null
}

function initial_state(): ComposeState {
    return {
        nodes: [],
        edges: [],
        selected_id: null,
        selected_edge_id: null,
        run_status: "idle",
        run_progress: 0,
        run_error: null,
        result: null,
    }
}

export const compose_state: ComposeState = $state(initial_state())

export interface ComposeViewport {
    x: number
    y: number
    zoom: number
    width: number
    height: number
}

export const compose_view: ComposeViewport = $state({ x: 0, y: 0, zoom: 1, width: 800, height: 420 })

export function flow_center_position(): { x: number; y: number } {
    const zoom = compose_view.zoom > 0 ? compose_view.zoom : 1
    return { x: (compose_view.width / 2 - compose_view.x) / zoom, y: (compose_view.height / 2 - compose_view.y) / zoom }
}

const preview_urls = new Map<string, string>()

export function preview_url(node_id: string): string | null {
    return preview_urls.get(node_id) ?? null
}

export function set_source_file(node_id: string, file: File, url: string): void {
    const previous = preview_urls.get(node_id)
    if (previous && previous !== url) {
        URL.revokeObjectURL(previous)
    }
    preview_urls.set(node_id, url)
    const node = compose_state.nodes.find((candidate) => candidate.id === node_id)
    if (node && node.type === "source") {
        node.data.file = file
        node.data.probe = null
    } else if (!node) {
        compose_state.nodes.push({
            id: node_id,
            type: "source",
            position: flow_center_position(),
            data: { file, probe: null },
        })
    }
}

export function set_source_probe(node_id: string, file: File, probe: ProbeResult): void {
    const node = compose_state.nodes.find((candidate) => candidate.id === node_id)
    if (node && node.type === "source" && node.data.file === file) {
        node.data.probe = probe
    }
}

export function upsert_probe(node_id: string, file: File, probe: ProbeResult | null, url: string): void {
    const previous = preview_urls.get(node_id)
    if (previous && previous !== url) {
        URL.revokeObjectURL(previous)
    }
    preview_urls.set(node_id, url)
    const node = compose_state.nodes.find((candidate) => candidate.id === node_id)
    if (node && node.type === "source") {
        node.data.file = file
        node.data.probe = probe
    } else if (!node) {
        compose_state.nodes.push({
            id: node_id,
            type: "source",
            position: flow_center_position(),
            data: { file, probe },
        })
    }
}

export function reset_compose(): void {
    if (compose_state.result) {
        URL.revokeObjectURL(compose_state.result.url)
        if (compose_state.result.sidecar_url) {
            URL.revokeObjectURL(compose_state.result.sidecar_url)
        }
    }
    compose_state.result = null
    compose_state.run_error = null
    compose_state.run_status = "idle"
    compose_state.run_progress = 0
}

export function remove_compose_nodes(node_ids: string[]): void {
    const ids = new Set(node_ids)
    if (ids.size === 0) {
        return
    }
    for (const id of ids) {
        const url = preview_urls.get(id)
        if (url !== undefined) {
            URL.revokeObjectURL(url)
            preview_urls.delete(id)
        }
    }
    compose_state.nodes = compose_state.nodes.filter((node) => !ids.has(node.id))
    const removed_edge_ids = new Set(
        compose_state.edges.filter((edge) => ids.has(edge.source) || ids.has(edge.target)).map((edge) => edge.id),
    )
    compose_state.edges = compose_state.edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target))
    if (compose_state.selected_id !== null && ids.has(compose_state.selected_id)) {
        compose_state.selected_id = null
    }
    if (compose_state.selected_edge_id !== null && removed_edge_ids.has(compose_state.selected_edge_id)) {
        compose_state.selected_edge_id = null
    }
}

export interface ComposeConnection {
    source: string | null | undefined
    sourceHandle: string | null | undefined
    target: string | null | undefined
    targetHandle: string | null | undefined
}

export function add_compose_edge(connection: ComposeConnection): { ok: boolean; error: string | null } {
    const source = connection.source ?? null
    const target = connection.target ?? null
    if (!source || !target) {
        return { ok: false, error: "Cannot connect: missing source or target." }
    }
    if (source === target) {
        return { ok: false, error: "Cannot connect a node to itself." }
    }
    const source_handle = connection.sourceHandle ?? null
    const target_handle = connection.targetHandle ?? null
    const by_id = new Map(compose_state.nodes.map((node) => [node.id, node]))
    const target_node = by_id.get(target)
    if (!by_id.has(source) || !target_node) {
        return { ok: false, error: "Cannot connect: unknown node." }
    }
    const duplicate = compose_state.edges.some(
        (edge) =>
            edge.source === source &&
            (edge.sourceHandle ?? null) === source_handle &&
            edge.target === target &&
            (edge.targetHandle ?? null) === target_handle,
    )
    if (duplicate) {
        return { ok: false, error: "Duplicate connection — this edge already exists." }
    }
    const incoming = compose_state.edges.filter((edge) => edge.target === target)
    switch (target_node.type) {
        case "source":
            return { ok: false, error: "Source nodes accept no inputs." }
        case "color":
            return { ok: false, error: "Color nodes accept no inputs." }
        case "trim":
        case "rescale":
        case "subtitles":
        case "overlay":
        case "output": {
            if (target_node.type === "overlay" && target_handle !== null) {
                return { ok: false, error: "Overlay inputs accept no handle." }
            }
            if (incoming.length >= 1) {
                const label =
                    target_node.type === "trim"
                        ? "Trim"
                        : target_node.type === "rescale"
                          ? "Rescale"
                          : target_node.type === "subtitles"
                            ? "Subtitles"
                            : target_node.type === "overlay"
                              ? "Overlay"
                              : "Output"
                return { ok: false, error: `${label} nodes accept 1 input — remove the existing connection first.` }
            }
            break
        }
        case "transition": {
            if (target_handle !== "a" && target_handle !== "b") {
                return { ok: false, error: 'Transition inputs must be "a" or "b".' }
            }
            if (incoming.some((edge) => (edge.targetHandle ?? null) === target_handle)) {
                return { ok: false, error: `Transition input "${target_handle}" is already connected.` }
            }
            if (incoming.length >= 2) {
                return { ok: false, error: "Transition nodes accept at most 2 inputs." }
            }
            break
        }
        case "merge": {
            if (target_handle === null || !/^in\d+$/.test(target_handle)) {
                return { ok: false, error: 'Merge inputs must be "in0", "in1", ...' }
            }
            if (incoming.some((edge) => (edge.targetHandle ?? null) === target_handle)) {
                return { ok: false, error: `Merge input "${target_handle}" is already connected.` }
            }
            const index = Number(target_handle.slice(2))
            if (!Number.isInteger(index) || index < 0 || index >= target_node.data.input_count) {
                return {
                    ok: false,
                    error: `Merge input "${target_handle}" is outside input_count ${target_node.data.input_count}.`,
                }
            }
            break
        }
    }
    compose_state.edges.push({
        id: crypto.randomUUID(),
        source,
        sourceHandle: source_handle,
        target,
        targetHandle: target_handle,
    })
    return { ok: true, error: null }
}

export function revoke_all(): void {
    for (const url of preview_urls.values()) {
        URL.revokeObjectURL(url)
    }
    preview_urls.clear()
    if (compose_state.result) {
        URL.revokeObjectURL(compose_state.result.url)
        if (compose_state.result.sidecar_url) {
            URL.revokeObjectURL(compose_state.result.sidecar_url)
        }
    }
    const fresh = initial_state()
    compose_state.nodes = fresh.nodes
    compose_state.edges = fresh.edges
    compose_state.selected_id = fresh.selected_id
    compose_state.selected_edge_id = fresh.selected_edge_id
    compose_state.run_status = fresh.run_status
    compose_state.run_progress = fresh.run_progress
    compose_state.run_error = fresh.run_error
    compose_state.result = fresh.result
}

export interface ComposeFileStub {
    name: string
    size: number
    type: string
}

function file_stub(file: File | null): ComposeFileStub | null {
    if (!file) {
        return null
    }
    return { name: file.name, size: file.size, type: file.type }
}

export function serialize_compose(nodes: ComposeNode[], edges: ComposeEdge[]): string {
    const serial_nodes = nodes.map((node) => {
        switch (node.type) {
            case "source":
                return {
                    id: node.id,
                    type: node.type,
                    position: node.position,
                    data: { file: file_stub(node.data.file), label: node.data.label ?? null },
                }
            case "subtitles":
                return {
                    id: node.id,
                    type: node.type,
                    position: node.position,
                    data: {
                        file: file_stub(node.data.file),
                        content: node.data.content,
                        mode: node.data.mode,
                        label: node.data.label ?? null,
                    },
                }
            case "overlay":
                return {
                    id: node.id,
                    type: node.type,
                    position: node.position,
                    data: {
                        image: file_stub(node.data.image),
                        position: node.data.position,
                        scale: node.data.scale,
                        opacity: node.data.opacity,
                        offset_x: node.data.offset_x,
                        offset_y: node.data.offset_y,
                        show_start: node.data.show_start,
                        show_end: node.data.show_end,
                        label: node.data.label ?? null,
                    },
                }
            default:
                return {
                    id: node.id,
                    type: node.type,
                    position: node.position,
                    data: { ...node.data, label: node.data.label ?? null },
                }
        }
    })
    return JSON.stringify({ version: 1, nodes: serial_nodes, edges }, null, 2)
}

function is_record(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parse_stub(value: unknown, node_id: string): ComposeFileStub | null {
    if (value === null) {
        return null
    }
    if (
        !is_record(value) ||
        typeof value.name !== "string" ||
        typeof value.size !== "number" ||
        typeof value.type !== "string"
    ) {
        throw new Error(`Node "${node_id}": invalid file stub`)
    }
    return { name: value.name, size: value.size, type: value.type }
}

function parse_label(value: unknown, node_id: string): string | null {
    if (value === undefined || value === null) {
        return null
    }
    if (typeof value === "string") {
        return value
    }
    throw new Error(`Node "${node_id}": invalid label`)
}

const AUDIO_QUALITIES = new Set(["96k", "128k", "192k", "256k", "320k", "source-max"])
const OUTPUT_QUALITIES = new Set(["low", "medium", "high", "very-high", "ultra"])
const EASINGS = new Set(["linear", "exponential"])
const SUBTITLE_MODES = new Set(["mux", "burn", "sidecar"])
const OVERLAY_POSITIONS = new Set([
    "top-left",
    "top-center",
    "top-right",
    "center-left",
    "center",
    "center-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
])

function parse_node(raw: unknown): ComposeNode {
    if (!is_record(raw) || typeof raw.id !== "string" || typeof raw.type !== "string") {
        throw new Error("Invalid compose JSON: each node needs a string id and type")
    }
    if (!is_record(raw.position) || typeof raw.position.x !== "number" || typeof raw.position.y !== "number") {
        throw new Error(`Node "${raw.id}": invalid position`)
    }
    if (!is_record(raw.data)) {
        throw new Error(`Node "${raw.id}": invalid data`)
    }
    const position = { x: raw.position.x, y: raw.position.y }
    switch (raw.type) {
        case "source":
            parse_stub(raw.data.file, raw.id)
            return {
                id: raw.id,
                type: "source",
                position,
                data: {
                    file: null,
                    probe: null,
                    label: parse_label(raw.data.label, raw.id),
                },
            }
        case "trim": {
            if (typeof raw.data.start !== "number" || typeof raw.data.end !== "number") {
                throw new Error(`Node "${raw.id}": trim needs numeric start and end`)
            }
            return {
                id: raw.id,
                type: "trim",
                position,
                data: { start: raw.data.start, end: raw.data.end, label: parse_label(raw.data.label, raw.id) },
            }
        }
        case "transition": {
            if (typeof raw.data.start !== "number" || typeof raw.data.duration !== "number") {
                throw new Error(`Node "${raw.id}": transition needs numeric start and duration`)
            }
            if (typeof raw.data.easing !== "string" || !EASINGS.has(raw.data.easing)) {
                throw new Error(`Node "${raw.id}": unknown transition easing`)
            }
            const raw_mode =
                typeof raw.data.audio_mode === "string" ? raw.data.audio_mode : TRANSITION_AUDIO_MODE_DEFAULT
            const audio_mode: TransitionAudioMode = TRANSITION_AUDIO_MODES.includes(raw_mode as TransitionAudioMode)
                ? (raw_mode as TransitionAudioMode)
                : TRANSITION_AUDIO_MODE_DEFAULT
            return {
                id: raw.id,
                type: "transition",
                position,
                data: {
                    start: raw.data.start,
                    duration: raw.data.duration,
                    easing: raw.data.easing as "linear" | "exponential",
                    audio_mode,
                    label: parse_label(raw.data.label, raw.id),
                },
            }
        }
        case "merge": {
            if (
                typeof raw.data.input_count !== "number" ||
                !Number.isInteger(raw.data.input_count) ||
                raw.data.input_count < 2 ||
                raw.data.input_count > 8
            ) {
                throw new Error(`Node "${raw.id}": merge needs input_count from 2 to 8`)
            }
            return {
                id: raw.id,
                type: "merge",
                position,
                data: { input_count: raw.data.input_count, label: parse_label(raw.data.label, raw.id) },
            }
        }
        case "subtitles": {
            parse_stub(raw.data.file, raw.id)
            if (raw.data.content !== null && typeof raw.data.content !== "string") {
                throw new Error(`Node "${raw.id}": invalid subtitle content`)
            }
            if (typeof raw.data.mode !== "string" || !SUBTITLE_MODES.has(raw.data.mode)) {
                throw new Error(`Node "${raw.id}": unknown subtitle mode`)
            }
            return {
                id: raw.id,
                type: "subtitles",
                position,
                data: {
                    file: null,
                    content: raw.data.content,
                    mode: raw.data.mode as "mux" | "burn" | "sidecar",
                    label: parse_label(raw.data.label, raw.id),
                },
            }
        }
        case "overlay": {
            parse_stub(raw.data.image, raw.id)
            if (typeof raw.data.position !== "string" || !OVERLAY_POSITIONS.has(raw.data.position)) {
                throw new Error(`Node "${raw.id}": unknown overlay position`)
            }
            if (
                typeof raw.data.scale !== "number" ||
                typeof raw.data.opacity !== "number" ||
                typeof raw.data.offset_x !== "number" ||
                typeof raw.data.offset_y !== "number" ||
                typeof raw.data.show_start !== "number"
            ) {
                throw new Error(`Node "${raw.id}": overlay needs numeric scale, opacity, offsets and show_start`)
            }
            if (raw.data.show_end !== null && typeof raw.data.show_end !== "number") {
                throw new Error(`Node "${raw.id}": invalid overlay show_end`)
            }
            return {
                id: raw.id,
                type: "overlay",
                position,
                data: {
                    image: null,
                    position: raw.data.position as
                        | "top-left"
                        | "top-center"
                        | "top-right"
                        | "center-left"
                        | "center"
                        | "center-right"
                        | "bottom-left"
                        | "bottom-center"
                        | "bottom-right",
                    scale: raw.data.scale,
                    opacity: raw.data.opacity,
                    offset_x: raw.data.offset_x,
                    offset_y: raw.data.offset_y,
                    show_start: raw.data.show_start,
                    show_end: raw.data.show_end,
                    label: parse_label(raw.data.label, raw.id),
                },
            }
        }
        case "color": {
            const color = raw.data.color === undefined ? "#000000" : raw.data.color
            if (typeof color !== "string") {
                throw new Error(`Node "${raw.id}": color needs a string color`)
            }
            const duration = raw.data.duration === undefined ? 20 : raw.data.duration
            if (typeof duration !== "number") {
                throw new Error(`Node "${raw.id}": color needs numeric duration`)
            }
            return {
                id: raw.id,
                type: "color",
                position,
                data: { color, duration, label: parse_label(raw.data.label, raw.id) },
            }
        }
        case "rescale": {
            const width = raw.data.width === undefined ? 1920 : raw.data.width
            const height = raw.data.height === undefined ? 1080 : raw.data.height
            if (typeof width !== "number" || typeof height !== "number") {
                throw new Error(`Node "${raw.id}": rescale needs numeric width and height`)
            }
            const fps = raw.data.fps === undefined ? null : raw.data.fps
            if (fps !== null && typeof fps !== "number") {
                throw new Error(`Node "${raw.id}": invalid rescale fps`)
            }
            const fit = raw.data.fit === undefined ? "contain" : raw.data.fit
            if (fit !== "contain") {
                throw new Error(`Node "${raw.id}": rescale fit must be "contain"`)
            }
            return {
                id: raw.id,
                type: "rescale",
                position,
                data: {
                    width,
                    height,
                    fps,
                    fit: fit as "contain",
                    label: parse_label(raw.data.label, raw.id),
                },
            }
        }
        case "output": {
            if (
                (raw.data.file_name !== null && typeof raw.data.file_name !== "string") ||
                typeof raw.data.width !== "number" ||
                typeof raw.data.height !== "number" ||
                typeof raw.data.fps !== "number"
            ) {
                throw new Error(`Node "${raw.id}": invalid output settings`)
            }
            if (typeof raw.data.quality !== "string" || !OUTPUT_QUALITIES.has(raw.data.quality)) {
                throw new Error(`Node "${raw.id}": unknown output quality`)
            }
            const audio_quality = raw.data.audio_quality ?? "source-max"
            if (typeof audio_quality !== "string" || !AUDIO_QUALITIES.has(audio_quality)) {
                throw new Error(`Node "${raw.id}": unknown output audio quality`)
            }
            let crf: number | null
            try {
                crf = parse_crf_override(raw.data.crf as number | string | null | undefined)
            } catch {
                throw new Error(`Node "${raw.id}": CRF must be a number from 0 to 51`)
            }
            return {
                id: raw.id,
                type: "output",
                position,
                data: {
                    file_name: raw.data.file_name,
                    width: raw.data.width,
                    height: raw.data.height,
                    fps: raw.data.fps,
                    quality: raw.data.quality as "low" | "medium" | "high" | "very-high" | "ultra",
                    audio_quality: audio_quality as "96k" | "128k" | "192k" | "256k" | "320k" | "source-max",
                    crf,
                    label: parse_label(raw.data.label, raw.id),
                },
            }
        }
        default:
            throw new Error(`Invalid compose JSON: unknown node type "${raw.type}"`)
    }
}

function parse_edge(raw: unknown, node_ids: Set<string>): ComposeEdge {
    if (
        !is_record(raw) ||
        typeof raw.id !== "string" ||
        typeof raw.source !== "string" ||
        typeof raw.target !== "string"
    ) {
        throw new Error("Invalid compose JSON: each edge needs string id, source and target")
    }
    if (!node_ids.has(raw.source) || !node_ids.has(raw.target)) {
        throw new Error(`Edge "${raw.id}": unknown source or target`)
    }
    if (raw.sourceHandle !== null && raw.sourceHandle !== undefined && typeof raw.sourceHandle !== "string") {
        throw new Error(`Edge "${raw.id}": invalid sourceHandle`)
    }
    if (raw.targetHandle !== null && raw.targetHandle !== undefined && typeof raw.targetHandle !== "string") {
        throw new Error(`Edge "${raw.id}": invalid targetHandle`)
    }
    return {
        id: raw.id,
        source: raw.source,
        sourceHandle: (raw.sourceHandle ?? null) as string | null,
        target: raw.target,
        targetHandle: (raw.targetHandle ?? null) as string | null,
    }
}

export function parse_compose_json(raw: string): {
    nodes: ComposeNode[]
    edges: ComposeEdge[]
    issues: ValidationIssue[]
} {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new Error("Invalid compose JSON: not valid JSON")
    }
    if (!is_record(parsed) || parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error("Invalid compose JSON: expected { version: 1, nodes: [], edges: [] }")
    }
    const nodes = parsed.nodes.map(parse_node)
    const seen = new Set<string>()
    for (const node of nodes) {
        if (seen.has(node.id)) {
            throw new Error(`Invalid compose JSON: duplicate node id "${node.id}"`)
        }
        seen.add(node.id)
    }
    const edges = parsed.edges.map((raw_edge) => parse_edge(raw_edge, seen))
    return { nodes, edges, issues: validate_compose(nodes, edges) }
}
