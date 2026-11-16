import { describe, expect, it, vi } from "vitest"
import { copy_text, format_framecode, format_viewer_summary } from "./framecode"

describe("format_framecode", () => {
    it.each([
        [0, 24, "00:00:00:00"],
        [5.4, 24, "00:00:05:09"],
        [3661.5, 24, "01:01:01:12"],
        [1, 0, "00:00:01:00"],
        [1, Number.NaN, "00:00:01:00"],
        [-5, 24, "00:00:00:00"],
    ])("formats %s @%sfps as %s", (time_s: number, fps: number, want: string) => {
        expect(format_framecode(time_s, fps)).toBe(want)
    })
})

describe("format_viewer_summary", () => {
    it("includes frame count and fps, omitting duration when null", () => {
        expect(format_viewer_summary(5.4, 24, null)).toContain("f129 @24fps")
        expect(format_viewer_summary(5.4, 24, null)).not.toContain("/")
        expect(format_viewer_summary(5.4, 24, 10)).toContain(" / ")
    })
    it("keeps byte-identical output when loudness is absent", () => {
        expect(format_viewer_summary(5.4, 24, 10)).toBe(format_viewer_summary(5.4, 24, 10, null))
        expect(format_viewer_summary(5.4, 24, null)).toBe(format_viewer_summary(5.4, 24, null, undefined))
        expect(format_viewer_summary(5.4, 24, 10)).toBe(format_viewer_summary(5.4, 24, 10, Number.NaN))
    })
    it("appends peak dBFS suffix when loudness is provided", () => {
        expect(format_viewer_summary(5.4, 24, 10, -3.24)).toContain("peak -3.2 dBFS")
        expect(format_viewer_summary(5.4, 24, 10, Number.NEGATIVE_INFINITY)).toContain("peak -∞ dBFS")
    })
})

describe("copy_text", () => {
    it("resolves true on clipboard success and false on failure", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal("navigator", { clipboard: { writeText } })
        await expect(copy_text("hello")).resolves.toBe(true)
        writeText.mockRejectedValueOnce(new Error("denied"))
        await expect(copy_text("hello")).resolves.toBe(false)
        vi.unstubAllGlobals()
    })
})
