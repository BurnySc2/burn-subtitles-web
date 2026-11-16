import { describe, expect, it } from "vitest"
import { compose_filename } from "./compose-filename"

describe("compose_filename", () => {
    it("builds a filename from stem and extension", () => {
        expect(compose_filename("my composition", "mp4")).toBe("my composition.mp4")
        expect(compose_filename("my composition", ".mp4")).toBe("my composition.mp4")
    })

    it("sanitizes illegal chars, caps at 60, and falls back", () => {
        expect(compose_filename("a".repeat(100), "mp4").length).toBe("a".repeat(60).length + 4)
        expect(compose_filename("01:02:03 mix", "mp4")).toBe("01-02-03 mix.mp4")
        expect(compose_filename("???", "mp4")).toBe("composition.mp4")
        expect(compose_filename("my video", "")).toBe("my video.mp4")
    })
})
