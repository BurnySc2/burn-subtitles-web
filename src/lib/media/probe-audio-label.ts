import type { ProbeResult } from "./mediabunny-clip"

type AudioProbe = Pick<ProbeResult, "has_audio" | "audio_codec" | "audio_codec_param" | "audio_bitrate">

export function format_kbps(bps: number | null | undefined): string | null {
    if (typeof bps !== "number" || !Number.isFinite(bps) || bps <= 0) {
        return null
    }
    return `${Math.round(bps / 1000)} kbps`
}

export function format_audio_label(probe: AudioProbe | null | undefined): string | null {
    if (!probe || !probe.has_audio) {
        return null
    }
    const codec = typeof probe.audio_codec === "string" && probe.audio_codec.trim() !== "" ? probe.audio_codec : null
    const param =
        typeof probe.audio_codec_param === "string" && probe.audio_codec_param.trim() !== ""
            ? probe.audio_codec_param
            : null
    const codec_part = codec ? (param ? `${codec} (${param})` : codec) : null
    const bitrate_part = format_kbps(probe.audio_bitrate)
    if (!codec_part && !bitrate_part) {
        return null
    }
    if (codec_part && bitrate_part) {
        return `${codec_part} · ${bitrate_part}`
    }
    if (codec_part) {
        return codec_part
    }
    return bitrate_part
}
