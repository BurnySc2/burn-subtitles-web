import { describe, expect, it } from "vitest"
import { format_audio_label, format_kbps } from "./probe-audio-label"

describe("format_kbps", () => {
    it("returns null for null, undefined, and invalid bitrates", () => {
        expect(format_kbps(null)).toBeNull()
        expect(format_kbps(undefined)).toBeNull()
        expect(format_kbps(Number.NaN)).toBeNull()
        expect(format_kbps(Number.POSITIVE_INFINITY)).toBeNull()
        expect(format_kbps(0)).toBeNull()
        expect(format_kbps(-8000)).toBeNull()
    })

    it("rounds to whole kbps", () => {
        expect(format_kbps(128000)).toBe("128 kbps")
        expect(format_kbps(128500)).toBe("129 kbps")
    })
})

describe("format_audio_label", () => {
    it("returns null for null probe or missing audio", () => {
        expect(format_audio_label(null)).toBeNull()
        expect(format_audio_label(undefined)).toBeNull()
        expect(
            format_audio_label({
                has_audio: false,
                audio_codec: "aac",
                audio_codec_param: null,
                audio_bitrate: 128000,
            }),
        ).toBeNull()
    })

    it("returns null when codec and bitrate are both missing", () => {
        expect(
            format_audio_label({ has_audio: true, audio_codec: null, audio_codec_param: null, audio_bitrate: null }),
        ).toBeNull()
    })

    it("formats codec-only and bitrate-only labels", () => {
        expect(
            format_audio_label({ has_audio: true, audio_codec: "aac", audio_codec_param: null, audio_bitrate: null }),
        ).toBe("aac")
        expect(
            format_audio_label({ has_audio: true, audio_codec: null, audio_codec_param: null, audio_bitrate: 128000 }),
        ).toBe("128 kbps")
    })

    it("combines codec and bitrate", () => {
        expect(
            format_audio_label({ has_audio: true, audio_codec: "aac", audio_codec_param: null, audio_bitrate: 128000 }),
        ).toBe("aac · 128 kbps")
    })

    it("includes the codec param when present", () => {
        expect(
            format_audio_label({
                has_audio: true,
                audio_codec: "mp3",
                audio_codec_param: "MPEG-1 Layer 3",
                audio_bitrate: 192000,
            }),
        ).toBe("mp3 (MPEG-1 Layer 3) · 192 kbps")
    })

    it("ignores zero and negative bitrates", () => {
        expect(
            format_audio_label({ has_audio: true, audio_codec: "aac", audio_codec_param: null, audio_bitrate: 0 }),
        ).toBe("aac")
        expect(
            format_audio_label({ has_audio: true, audio_codec: "aac", audio_codec_param: null, audio_bitrate: -1000 }),
        ).toBe("aac")
    })
})
