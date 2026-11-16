import { find_output_node } from "./compose-graph"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import type { ProbeResult } from "./mediabunny-clip"
import {
    resolve_audio_bitrate,
    type TransitionAudioBitrateProbe,
    type TransitionAudioQuality,
} from "./transition-utils"

export function union_probe_lists(lists: Array<readonly ProbeResult[] | null | undefined>): ProbeResult[] {
    const seen = new Set<ProbeResult>()
    const union: ProbeResult[] = []
    for (const list of lists) {
        if (!list) {
            continue
        }
        for (const probe of list) {
            if (seen.has(probe)) {
                continue
            }
            seen.add(probe)
            union.push(probe)
        }
    }
    return union
}

function is_positive_finite(value: number | null | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function peak_audio_probe(
    probes: readonly ProbeResult[] | null | undefined,
): TransitionAudioBitrateProbe | null {
    if (!probes) {
        return null
    }
    let peak_audio: number | null = null
    let peak_overall: number | null = null
    for (const probe of probes) {
        if (is_positive_finite(probe.audio_bitrate) && (peak_audio === null || probe.audio_bitrate > peak_audio)) {
            peak_audio = probe.audio_bitrate
        }
        if (
            is_positive_finite(probe.overall_bitrate) &&
            (peak_overall === null || probe.overall_bitrate > peak_overall)
        ) {
            peak_overall = probe.overall_bitrate
        }
    }
    if (peak_audio !== null) {
        return { audio_bitrate: peak_audio, overall_bitrate: null }
    }
    if (peak_overall !== null) {
        return { audio_bitrate: peak_overall, overall_bitrate: null }
    }
    return null
}

export function collect_output_probes(nodes: ComposeNode[], edges: ComposeEdge[]): ProbeResult[] {
    const output = find_output_node(nodes)
    if (!output) {
        return []
    }
    const known = new Set(nodes.map((node) => node.id))
    const incoming = new Map<string, string[]>()
    for (const edge of edges) {
        if (!known.has(edge.source) || !known.has(edge.target)) {
            continue
        }
        const list = incoming.get(edge.target) ?? []
        list.push(edge.source)
        incoming.set(edge.target, list)
    }
    const seen = new Set<string>([output.id])
    const stack: string[] = [output.id]
    while (stack.length > 0) {
        const current = stack.pop() as string
        for (const prev of incoming.get(current) ?? []) {
            if (!seen.has(prev)) {
                seen.add(prev)
                stack.push(prev)
            }
        }
    }
    const lists: Array<readonly ProbeResult[]> = []
    for (const node of nodes) {
        if (node.type === "source" && node.data.probe && seen.has(node.id)) {
            lists.push([node.data.probe])
        }
    }
    return union_probe_lists(lists)
}

export function resolve_output_audio_bps(
    nodes: ComposeNode[],
    edges: ComposeEdge[],
    quality: TransitionAudioQuality,
): number {
    return resolve_audio_bitrate(peak_audio_probe(collect_output_probes(nodes, edges)), null, quality)
}
