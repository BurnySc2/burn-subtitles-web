import type { ComposeNode, ComposeNodeKind, OutputNodeData } from "./compose-types"
import { resolve_output_video_config, type TransitionVideoConfig } from "./transition-utils"

// Mirrors canvas re-encode branches in compose-executor.ts:212-339
export const REENCODE_NODE_KINDS: ReadonlySet<ComposeNodeKind> = new Set<ComposeNodeKind>([
    "transition",
    "merge",
    "overlay",
    "text",
    "color",
    "rescale",
    "subtitles",
])

export function has_reencode_sink(nodes: ComposeNode[]): boolean {
    return nodes.some((node) => REENCODE_NODE_KINDS.has(node.type as ComposeNodeKind))
}

export function effective_encode_config(output: OutputNodeData): TransitionVideoConfig {
    return resolve_output_video_config(output)
}

export function format_encode_hint(config: TransitionVideoConfig): string {
    return `Effective: ${config.bitrate / 1_000_000} Mbps VBR`
}

export function encode_hint_for_graph(
    nodes: ComposeNode[],
    output?: OutputNodeData | null,
): { reencodes: boolean; text: string | null } {
    const reencodes = has_reencode_sink(nodes)
    if (!reencodes) {
        return { reencodes, text: "Passthrough graph (source/trim→output only): no re-encode" }
    }
    if (!output) {
        return { reencodes, text: null }
    }
    return { reencodes, text: format_encode_hint(effective_encode_config(output)) }
}
