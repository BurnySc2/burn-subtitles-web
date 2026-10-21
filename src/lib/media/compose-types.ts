import type { ProbeResult } from "./mediabunny-clip"
import type { TransitionAudioQuality, TransitionEasing, TransitionQuality } from "./transition-utils"

export type ComposeNodeKind = "source" | "trim" | "transition" | "merge" | "subtitles" | "output"

export interface SourceNodeData {
    file: File | null
    probe: ProbeResult | null
    label?: string | null
}

export interface TrimNodeData {
    start: number
    end: number
    label?: string | null
}

export interface TransitionNodeData {
    start: number
    duration: number
    easing: TransitionEasing
    label?: string | null
}

export interface MergeNodeData {
    input_count: number
    label?: string | null
}

export type SubtitleRenderMode = "mux" | "burn" | "sidecar"

export interface SubtitlesNodeData {
    file: File | null
    content: string | null
    mode: SubtitleRenderMode
    label?: string | null
}

export interface OutputNodeData {
    file_name: string | null
    width: number
    height: number
    fps: number
    quality: TransitionQuality
    audio_quality?: TransitionAudioQuality
    crf?: number | null
    label?: string | null
}

export type ComposeNodeData =
    | SourceNodeData
    | TrimNodeData
    | TransitionNodeData
    | MergeNodeData
    | SubtitlesNodeData
    | OutputNodeData

export interface ComposePosition {
    x: number
    y: number
}

export type ComposeNode =
    | { id: string; type: "source"; position: ComposePosition; data: SourceNodeData }
    | { id: string; type: "trim"; position: ComposePosition; data: TrimNodeData }
    | { id: string; type: "transition"; position: ComposePosition; data: TransitionNodeData }
    | { id: string; type: "merge"; position: ComposePosition; data: MergeNodeData }
    | { id: string; type: "subtitles"; position: ComposePosition; data: SubtitlesNodeData }
    | { id: string; type: "output"; position: ComposePosition; data: OutputNodeData }

export interface ComposeEdge {
    id: string
    source: string
    sourceHandle: string | null
    target: string
    targetHandle: string | null
}

export interface ValidationIssue {
    node_id: string | null
    field: string | null
    message: string
}

export function compose_node_title(type: ComposeNodeKind, label: string | null | undefined): string {
    const trimmed = label?.trim() ?? ""
    if (trimmed !== "") {
        return trimmed
    }
    return type.charAt(0).toUpperCase() + type.slice(1)
}

export interface ComposeRunOutput {
    url: string
    mime: string
    ext: string
    size_bytes: number
    sidecar_url: string | null
}

export interface ComposeRunResult {
    ok: boolean
    issues: ValidationIssue[]
    output: ComposeRunOutput | null
}
