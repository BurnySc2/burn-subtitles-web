import { describe, expect, it } from "vitest"
import { default_output_kind } from "./mediabunny-clip"

describe("default_output_kind", () => {
    it("returns mp4 when the probe has video", () => {
        expect(default_output_kind({ has_video: true, audio_codec: "mp3", container: "mp3" })).toBe("mp4")
    })

    it("returns mp3 for audio-only mp3 sources", () => {
        expect(default_output_kind({ has_video: false, audio_codec: "mp3", container: null })).toBe("mp3")
        expect(default_output_kind({ has_video: false, audio_codec: null, container: "mp3" })).toBe("mp3")
    })

    it("returns flac for flac or unknown audio-only sources", () => {
        expect(default_output_kind({ has_video: false, audio_codec: "flac", container: null })).toBe("flac")
        expect(default_output_kind({ has_video: false })).toBe("flac")
    })
})
