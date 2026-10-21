import { describe, expect, it } from "vitest"
import { clip_basename, clip_filename, sanitize_filename } from "./clip-filename"

describe("clip_filename", () => {
    it("builds a template filename and strips the source extension", () => {
        expect(clip_filename("talk.mp4", "00:00:01.000", "00:00:02.000", "mp4")).toBe(
            "talk_00-00-01.000-00-00-02.000.mp4",
        )
        expect(clip_filename("talk.mp4", "00:00:01.000", "00:00:02.000", ".mp4")).toBe(
            "talk_00-00-01.000-00-00-02.000.mp4",
        )
        expect(clip_basename("talk.mp4")).toBe("talk")
    })

    it("sanitizes illegal chars, caps at 60, and falls back to clip", () => {
        expect(sanitize_filename("a".repeat(100)).length).toBe(60)
        expect(clip_basename("???")).toBe("clip")
        expect(clip_basename("my video.mp4")).toBe("my video")
    })

    it("converts colons to dashes", () => {
        expect(sanitize_filename("01:02:03.000")).toBe("01-02-03.000")
    })
})
