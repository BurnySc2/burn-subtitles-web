import type { ProbeResult } from "./mediabunny-clip"
import type {
    TransitionAudioMode,
    TransitionAudioQuality,
    TransitionEasing,
    TransitionQuality,
} from "./transition-utils"

export type ComposeNodeKind =
    | "source"
    | "trim"
    | "transition"
    | "merge"
    | "subtitles"
    | "overlay"
    | "color"
    | "rescale"
    | "text"
    | "output"

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
    audio_mode?: TransitionAudioMode
    label?: string | null
}

export interface MergeNodeData {
    input_count: number
    label?: string | null
}

export type SubtitleVerticalAnchor = "top" | "center" | "bottom"

export const SUBTITLE_BURN_DEFAULTS = {
    font_file: null,
    font_size: 24,
    text_color: "#ffff7f",
    stroke_color: "#000000",
    outline_size: 1,
    shadow_size: 0,
    horizontal_margin: 30,
    vertical_anchor: "bottom",
    vertical_offset: 0,
    right_to_left: false,
} as const

export interface SubtitlesNodeData {
    file: File | null
    mode: "burn"
    font_file?: File | null
    font_size?: number
    text_color?: string
    stroke_color?: string
    outline_size?: number
    shadow_size?: number
    horizontal_margin?: number
    vertical_anchor?: SubtitleVerticalAnchor
    vertical_offset?: number
    right_to_left?: boolean
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

export type OverlayPosition =
    | "top-left"
    | "top-center"
    | "top-right"
    | "center-left"
    | "center"
    | "center-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"

export interface OverlayNodeData {
    image: File | null
    position: OverlayPosition
    scale: number
    opacity: number
    offset_x: number
    offset_y: number
    show_start: number
    show_end: number | null
    label?: string | null
}

export interface ColorNodeData {
    color: string
    duration: number
    label?: string | null
}

export interface RescaleNodeData {
    width: number
    height: number
    fps: number | null
    fit: "contain"
    label?: string | null
}

export interface TextItem {
    text: string
    font: string
    size_start: number
    size_end: number
    color: string
    opacity: number
    anchor: OverlayPosition
    offset_x: number
    offset_y: number
    align: "left" | "center" | "right"
    max_width: number | null
    show_start: number
    show_end: number | null
    fade_in: number
    fade_out: number
}

export interface TextNodeData {
    items: TextItem[]
    label?: string | null
}

export const MAX_TEXT_ITEMS = 32 as const

export const TEXT_ANCHORS: readonly OverlayPosition[] = [
    "top-left",
    "top-center",
    "top-right",
    "center-left",
    "center",
    "center-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
]

export function create_default_text_item(): TextItem {
    return {
        text: "Hello",
        font: "sans-serif",
        size_start: 48,
        size_end: 48,
        color: "#ffffff",
        opacity: 1,
        anchor: "bottom-center",
        offset_x: 0,
        // offset is inset from edge, 0 = flush (may clip half glyph with textBaseline middle).
        offset_y: 0,
        align: "center",
        max_width: null,
        show_start: 0,
        show_end: null,
        fade_in: 0,
        fade_out: 0,
    }
}

export type ComposeNodeData =
    | SourceNodeData
    | TrimNodeData
    | TransitionNodeData
    | MergeNodeData
    | SubtitlesNodeData
    | OverlayNodeData
    | ColorNodeData
    | RescaleNodeData
    | TextNodeData
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
    | { id: string; type: "overlay"; position: ComposePosition; data: OverlayNodeData }
    | { id: string; type: "color"; position: ComposePosition; data: ColorNodeData }
    | { id: string; type: "rescale"; position: ComposePosition; data: RescaleNodeData }
    | { id: string; type: "text"; position: ComposePosition; data: TextNodeData }
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
}

export interface ComposeRunResult {
    ok: boolean
    issues: ValidationIssue[]
    output: ComposeRunOutput | null
}
