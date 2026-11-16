import { describe, expect, it } from "vitest"
import { peak_audio_probe, union_probe_lists } from "./compose-probe-union"
import type { ProbeResult } from "./mediabunny-clip"

function make_probe(overrides: Partial<ProbeResult> = {}): ProbeResult {
    return {
        duration: null,
        has_video: false,
        has_audio: true,
        kind: "audio-only",
        file_name: "test",
        file_size: 0,
        container: null,
        mime_type: "audio/mpeg",
        overall_bitrate: null,
        video_count: 0,
        audio_count: 1,
        video_codec: null,
        video_codec_param: null,
        display_width: null,
        display_height: null,
        coded_width: null,
        coded_height: null,
        frame_rate: null,
        video_bitrate: null,
        audio_codec: null,
        audio_codec_param: null,
        audio_channels: null,
        audio_sample_rate: null,
        audio_bitrate: null,
        can_play: true,
        ...overrides,
    }
}

describe("union_probe_lists", () => {
    it("returns empty for empty input", () => {
        expect(union_probe_lists([])).toEqual([])
    })

    it("drops null and undefined lists", () => {
        expect(union_probe_lists([null, undefined])).toEqual([])
    })

    it("flattens lists in order", () => {
        const a = make_probe({ file_name: "a" })
        const b = make_probe({ file_name: "b" })
        expect(union_probe_lists([[a], null, [b]])).toEqual([a, b])
    })

    it("dedupes by reference", () => {
        const shared = make_probe({ file_name: "shared" })
        expect(union_probe_lists([[shared], [shared]])).toEqual([shared])
    })

    it("keeps distinct probes with equal content", () => {
        const first = make_probe({ file_name: "same" })
        const second = make_probe({ file_name: "same" })
        expect(union_probe_lists([[first, second]])).toEqual([first, second])
    })
})

describe("peak_audio_probe", () => {
    it("returns null for null input", () => {
        expect(peak_audio_probe(null)).toBeNull()
    })

    it("returns null for undefined input", () => {
        expect(peak_audio_probe(undefined)).toBeNull()
    })

    it("returns null for empty input", () => {
        expect(peak_audio_probe([])).toBeNull()
    })

    it("returns null when no bitrates are present", () => {
        expect(peak_audio_probe([make_probe()])).toBeNull()
    })

    it("ignores non-finite and non-positive bitrates", () => {
        const probes = [
            make_probe({ audio_bitrate: 0, overall_bitrate: -10 }),
            make_probe({ audio_bitrate: Number.NaN, overall_bitrate: Number.POSITIVE_INFINITY }),
        ]
        expect(peak_audio_probe(probes)).toBeNull()
    })

    it("returns the peak audio bitrate", () => {
        const probes = [make_probe({ audio_bitrate: 96_000 }), make_probe({ audio_bitrate: 192_000 })]
        expect(peak_audio_probe(probes)).toEqual({ audio_bitrate: 192_000, overall_bitrate: null })
    })

    it("prefers audio over a higher overall bitrate", () => {
        const probes = [make_probe({ audio_bitrate: 128_000, overall_bitrate: 500_000 })]
        expect(peak_audio_probe(probes)).toEqual({ audio_bitrate: 128_000, overall_bitrate: null })
    })

    it("falls back to the peak overall bitrate", () => {
        const probes = [make_probe({ overall_bitrate: 200_000 }), make_probe({ overall_bitrate: 300_000 })]
        expect(peak_audio_probe(probes)).toEqual({ audio_bitrate: 300_000, overall_bitrate: null })
    })

    it("passes low peaks through unclamped", () => {
        expect(peak_audio_probe([make_probe({ audio_bitrate: 40_000 })])).toEqual({
            audio_bitrate: 40_000,
            overall_bitrate: null,
        })
    })

    it("passes high peaks through unclamped", () => {
        expect(peak_audio_probe([make_probe({ audio_bitrate: 500_000 })])).toEqual({
            audio_bitrate: 500_000,
            overall_bitrate: null,
        })
    })
})
