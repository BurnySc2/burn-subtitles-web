import { describe, expect, it } from "vitest"
import { capture_encode_report, format_encode_badge } from "./encode-report"
import type { TransitionVideoConfig } from "./transition-utils"

function requested(bitrate = 16_000_000): TransitionVideoConfig {
    return { bitrate, description: "test" }
}

function effective_config(): VideoEncoderConfig {
    return {
        codec: "avc",
        width: 1280,
        height: 720,
        bitrate: 16_000_000,
        bitrateMode: "variable",
        hardwareAcceleration: "no-preference",
    } as VideoEncoderConfig
}

describe("capture_encode_report", () => {
    it("falls back when effective is null", () => {
        const report = capture_encode_report(null, requested())
        expect(report.fell_back).toBe(true)
        expect(report.effective).toBeNull()
    })

    it("does not fall back when effective is present", () => {
        const report = capture_encode_report(effective_config(), requested())
        expect(report.fell_back).toBe(false)
    })
})

describe("format_encode_badge", () => {
    it("returns null for a null report", () => {
        expect(format_encode_badge(null)).toBeNull()
    })

    it("reports a fallback VBR bitrate", () => {
        const report = capture_encode_report(null, requested())
        expect(format_encode_badge(report)).toBe("Fell back to 16M VBR")
    })

    it("returns null without fallback", () => {
        const report = capture_encode_report(effective_config(), requested())
        expect(format_encode_badge(report)).toBeNull()
    })
})
