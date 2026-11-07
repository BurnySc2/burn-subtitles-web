import type { ComposeOutputNode } from "./compose-graph"
import { srt_to_vtt } from "./compose-subtitles"
import type { ComposeEdge, ComposeNode, RescaleNodeData } from "./compose-types"
import { ClipError } from "./mediabunny-clip"
import {
    render_compose_stack,
    type StackHead,
    type StackLayer,
    type StackSegment,
    type StackTarget,
} from "./mediabunny-compose-stack"

export function blob_to_file(blob: Blob, name: string): File {
    return blob instanceof File ? blob : new File([blob], name, { type: blob.type })
}

export function single_input(node_id: string, incoming: Map<string, ComposeEdge[]>, memo: Map<string, Blob>): Blob {
    const edges = incoming.get(node_id) ?? []
    const blob = edges.length === 1 ? (memo.get(edges[0].source) ?? null) : null
    if (!blob) {
        throw new ClipError("FAILED", "Node input is missing.")
    }
    return blob
}

export interface FusedDispatch {
    segment: StackSegment
    end_id: string
    fused_ids: Set<string>
    span: number
}

export function build_fused_dispatch(
    segments: StackSegment[],
    by_id: Map<string, ComposeNode>,
    output_id: string | null,
): Map<string, FusedDispatch> {
    const dispatch = new Map<string, FusedDispatch>()
    for (const segment of segments) {
        let layer_count = 0
        for (const id of segment.node_ids) {
            const node = by_id.get(id)
            if (node?.type === "overlay" || node?.type === "text") {
                layer_count += 1
            }
        }
        if (layer_count === 0) {
            continue
        }
        const fused = segment.node_ids.filter((id) => id !== segment.head_id && id !== output_id)
        if (fused.length === 0) {
            continue
        }
        const end_id = fused[fused.length - 1]
        const entry: FusedDispatch = { segment, end_id, fused_ids: new Set(fused), span: fused.length }
        for (const id of fused) {
            if (!dispatch.has(id)) {
                dispatch.set(id, entry)
            }
        }
    }
    return dispatch
}

export function resolve_stack_layers(segment: StackSegment, by_id: Map<string, ComposeNode>): StackLayer[] {
    const layers: StackLayer[] = []
    for (const id of segment.node_ids) {
        const node = by_id.get(id)
        if (node?.type === "overlay") {
            if (!node.data.image) {
                throw new ClipError("FAILED", "Overlay image is missing.")
            }
            layers.push({ kind: "overlay", node_id: id, data: node.data, image: node.data.image })
        } else if (node?.type === "text") {
            layers.push({ kind: "text", node_id: id, items: node.data.items })
        }
    }
    return layers
}

export function resolve_stack_head(
    segment: StackSegment,
    by_id: Map<string, ComposeNode>,
    incoming: Map<string, ComposeEdge[]>,
    memo: Map<string, Blob>,
): StackHead {
    if (segment.head_id) {
        const head_node = by_id.get(segment.head_id) ?? null
        if (head_node?.type === "source") {
            const file = memo.get(segment.head_id) ?? head_node.data.file
            if (!file) {
                throw new ClipError("FAILED", "Source file is missing.")
            }
            return { kind: "blob", file: blob_to_file(file, "stack-head.mp4") }
        }
        if (head_node?.type === "color") {
            return { kind: "solid", color: head_node.data.color, duration: head_node.data.duration }
        }
        throw new ClipError("FAILED", "Stack head is missing.")
    }
    const first_fused = segment.node_ids.find((id) => {
        const node = by_id.get(id)
        return node?.type === "overlay" || node?.type === "text" || node?.type === "rescale"
    })
    if (!first_fused) {
        throw new ClipError("FAILED", "Stack head is missing.")
    }
    const input = single_input(first_fused, incoming, memo)
    return { kind: "blob", file: blob_to_file(input, "stack-head.mp4") }
}

export function resolve_stack_target(
    segment: StackSegment,
    by_id: Map<string, ComposeNode>,
    output_node: ComposeOutputNode | null,
): { target: StackTarget; terminal_rescale: RescaleNodeData | null } {
    const output_width = output_node?.data.width ?? 1920
    const output_height = output_node?.data.height ?? 1080
    const output_fps = output_node?.data.fps ?? 30
    const output_quality: StackTarget["quality"] = output_node?.data.quality ?? "medium"
    const output_crf: StackTarget["crf"] = output_node?.data.crf ?? null
    const output_audio: StackTarget["audio_quality"] = output_node?.data.audio_quality ?? "source-max"
    const terminal_node = segment.terminal_rescale_id ? (by_id.get(segment.terminal_rescale_id) ?? null) : null
    const terminal_rescale: RescaleNodeData | null = terminal_node?.type === "rescale" ? terminal_node.data : null
    if (terminal_rescale) {
        return {
            target: {
                width: terminal_rescale.width,
                height: terminal_rescale.height,
                fps: terminal_rescale.fps ?? output_fps,
                quality: output_quality,
                crf: output_crf,
                audio_quality: output_audio,
            },
            terminal_rescale,
        }
    }
    return {
        target: {
            width: output_width,
            height: output_height,
            fps: output_fps,
            quality: output_quality,
            crf: output_crf,
            audio_quality: output_audio,
        },
        terminal_rescale: null,
    }
}

export interface ExecuteFusedSegmentOptions {
    include_sidecar?: boolean
}

export async function execute_fused_segment(
    dispatch: FusedDispatch,
    by_id: Map<string, ComposeNode>,
    incoming: Map<string, ComposeEdge[]>,
    memo: Map<string, Blob>,
    output_node: ComposeOutputNode | null,
    on_slice: (progress: number) => void,
    signal?: AbortSignal,
    options: ExecuteFusedSegmentOptions = {},
): Promise<{ blob: Blob; sidecar_vtt: string | null }> {
    const { segment } = dispatch
    const layers = resolve_stack_layers(segment, by_id)
    const head = resolve_stack_head(segment, by_id, incoming, memo)
    const { target, terminal_rescale } = resolve_stack_target(segment, by_id, output_node)
    let sidecar_vtt: string | null = null
    if (options.include_sidecar) {
        for (const id of segment.node_ids) {
            const node = by_id.get(id)
            if (node?.type === "subtitles" && (node.data.mode === "mux" || node.data.mode === "sidecar")) {
                const content = node.data.content ?? (node.data.file ? await node.data.file.text() : null)
                if (content === null || content.trim() === "") {
                    throw new ClipError("FAILED", "Subtitle content is empty.")
                }
                if (node.data.mode === "sidecar") {
                    sidecar_vtt ??= srt_to_vtt(content)
                }
            }
        }
    }
    const result = await render_compose_stack({
        head,
        layers,
        target,
        terminal_rescale,
        signal,
        on_progress: on_slice,
    })
    return { blob: result.blob, sidecar_vtt }
}
