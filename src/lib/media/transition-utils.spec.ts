import { describe, expect, it } from "vitest"
import { TimecodeError } from "./timecode"
import { transition_filename } from "./transition-filename"
import {
    EASING_REGISTRY,
    quality_to_video_config,
    resolve_duration_seconds,
    resolve_output_dims,
    resolve_output_fps,
} from "./transition-utils"

describe("EASING_REGISTRY", () => {
    it("maps linear to identity and exponential to quadratic", () => {
        expect(EASING_REGISTRY.linear(0)).toBe(0)
        expect(EASING_REGISTRY.linear(0.5)).toBe(0.5)
        expect(EASING_REGISTRY.linear(1)).toBe(1)
        expect(EASING_REGISTRY.exponential(0)).toBe(0)
        expect(EASING_REGISTRY.exponential(0.5)).toBe(0.25)
        expect(EASING_REGISTRY.exponential(1)).toBe(1)
    })
})

describe("resolve_output_dims", () => {
    const probe_a = { display_width: 1920, display_height: 1080 }
    const probe_b = { display_width: 1280, display_height: 720 }

    it("selects dims from the chosen resolution source", () => {
        expect(resolve_output_dims(probe_a, probe_b, "a")).toEqual({ width: 1920, height: 1080 })
        expect(resolve_output_dims(probe_a, probe_b, "b")).toEqual({ width: 1280, height: 720 })
    })

    it("falls back to the other probe and returns null when neither has dims", () => {
        expect(resolve_output_dims(null, probe_b, "a")).toEqual({ width: 1280, height: 720 })
        expect(resolve_output_dims(probe_a, null, "b")).toEqual({ width: 1920, height: 1080 })
        expect(resolve_output_dims(null, null, "a")).toBeNull()
        expect(resolve_output_dims({ display_width: 1920, display_height: null }, null, "a")).toBeNull()
    })
})

describe("resolve_output_fps", () => {
    it("returns fixed modes numerically", () => {
        expect(resolve_output_fps(null, null, "24")).toBe(24)
        expect(resolve_output_fps(null, null, "30")).toBe(30)
        expect(resolve_output_fps(null, null, "60")).toBe(60)
    })

    it("reads the chosen probe and falls back to 30 when missing", () => {
        expect(resolve_output_fps({ frame_rate: 25 }, { frame_rate: 50 }, "a")).toBe(25)
        expect(resolve_output_fps({ frame_rate: 25 }, { frame_rate: 50 }, "b")).toBe(50)
        expect(resolve_output_fps(null, null, "a")).toBe(30)
        expect(resolve_output_fps({ frame_rate: null }, null, "a")).toBe(30)
        expect(resolve_output_fps({ frame_rate: 0 }, null, "b")).toBe(30)
    })
})

describe("resolve_duration_seconds", () => {
    it("accepts a positive duration within the shortest source", () => {
        expect(resolve_duration_seconds("1.0", 10, 8)).toBe(1)
        expect(resolve_duration_seconds("8", 10, 8)).toBe(8)
        expect(resolve_duration_seconds("2.5", null, null)).toBe(2.5)
    })

    it("rejects non-positive, malformed, or overlong durations", () => {
        for (const raw of ["0", "-1", "abc", "", "  "]) {
            expect(() => resolve_duration_seconds(raw, 10, 8)).toThrow(TimecodeError)
        }
        expect(() => resolve_duration_seconds("9", 10, 8)).toThrow(TimecodeError)
        expect(() => resolve_duration_seconds("11", 10, null)).toThrow(TimecodeError)
    })
})

describe("quality_to_video_config", () => {
    it("maps each quality to its bitrate ceiling", () => {
        expect(quality_to_video_config("low", 1920, 1080, 30).bitrate).toBe(2_000_000)
        expect(quality_to_video_config("medium", 1920, 1080, 30).bitrate).toBe(5_000_000)
        expect(quality_to_video_config("high", 1920, 1080, 30).bitrate).toBe(10_000_000)
        expect(quality_to_video_config("very-high", 1920, 1080, 30).bitrate).toBe(16_000_000)
        expect(quality_to_video_config("lossless", 1920, 1080, 30).bitrate).toBe(50_000_000)
    })
})

describe("transition_filename", () => {
    it("joins both basenames with duration and strips extensions", () => {
        expect(transition_filename("intro.mp4", "outro.mkv", 1.5, "mp4")).toBe("intro_x_outro_1.5s.mp4")
        expect(transition_filename("intro.mp4", "outro.mkv", 1, ".mp4")).toBe("intro_x_outro_1s.mp4")
    })

    it("sanitizes illegal chars from both names", () => {
        expect(transition_filename("my: video.mp4", "clip?2.mkv", 2, "mp4")).toBe("my- video_x_clip2_2s.mp4")
    })
})
