import type { ProbeResult } from "./mediabunny-clip"
import type { TransitionAudioQuality, TransitionEasing, TransitionQuality } from "./transition-utils"

export type ComposeNodeKind = "source" | "trim" | "transition" | "subtitles" | "output"

export interface SourceNodeData {
    file: File | null
    probe: ProbeResult | null
}

export interface TrimNodeData {
    start: number
    end: number
}

export interface TransitionNodeData {
    start: number
    duration: number
    easing: TransitionEasing
}

export type SubtitleRenderMode = "mux" | "burn" | "sidecar"

export interface SubtitlesNodeData {
    file: File | null
    content: string | null
    mode: SubtitleRenderMode
}

export interface OutputNodeData {
    file_name: string | null
    width: number
    height: number
    fps: number
    quality: TransitionQuality
    audio_quality?: TransitionAudioQuality
    crf?: number | null
}

export type ComposeNodeData = SourceNodeData | TrimNodeData | TransitionNodeData | SubtitlesNodeData | OutputNodeData

export interface ComposePosition {
    x: number
    y: number
}

export type ComposeNode =
    | { id: string; type: "source"; position: ComposePosition; data: SourceNodeData }
    | { id: string; type: "trim"; position: ComposePosition; data: TrimNodeData }
    | { id: string; type: "transition"; position: ComposePosition; data: TransitionNodeData }
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
