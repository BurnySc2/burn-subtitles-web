import { describe, expect, it } from "vitest"
import { capture_encode_report, format_encode_badge } from "./encode-report"
import type { TransitionVideoConfig } from "./transition-utils"

function requested(bitrate = 16_000_000, quantizer: number | null = 18): TransitionVideoConfig {
    return { bitrate, quantizer, description: "test" }
}

function effective_config(mode: "quantizer" | "variable" = "variable"): VideoEncoderConfig {
    return {
        codec: "avc",
        width: 1280,
        height: 720,
        bitrate: 16_000_000,
        bitrateMode: mode,
        hardwareAcceleration: "no-preference",
    } as VideoEncoderConfig
}

describe("capture_encode_report", () => {
    it("falls back when effective is null", () => {
        const report = capture_encode_report(null, requested())
        expect(report.fell_back).toBe(true)
        expect(report.effective).toBeNull()
    })

    it("keeps quantizer when effective preserves it", () => {
        const report = capture_encode_report(effective_config("quantizer"), requested())
        expect(report.fell_back).toBe(false)
    })

    it("falls back when effective drops the requested quantizer", () => {
        const report = capture_encode_report(effective_config("variable"), requested())
        expect(report.fell_back).toBe(true)
    })

    it("does not fall back for bitrate-only when effective has no quantizer", () => {
        const report = capture_encode_report(effective_config("variable"), requested(16_000_000, null))
        expect(report.fell_back).toBe(false)
    })
})

describe("format_encode_badge", () => {
    it("returns null for a null report", () => {
        expect(format_encode_badge(null)).toBeNull()
    })

    it("reports an active quantizer", () => {
        const report = capture_encode_report(effective_config("quantizer"), requested(16_000_000, 10))
        expect(format_encode_badge(report)).toBe("Quantizer active (Q10)")
    })

    it("reports a fallback bitrate", () => {
        const report = capture_encode_report(null, requested())
        expect(format_encode_badge(report)).toBe("Fell back to 16M bitrate")
    })

    it("returns null for bitrate-only without fallback", () => {
        const report = capture_encode_report(effective_config("variable"), requested(16_000_000, null))
        expect(format_encode_badge(report)).toBeNull()
    })
})
