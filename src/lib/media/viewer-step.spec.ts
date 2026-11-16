import { describe, expect, it } from "vitest"
import {
    clamp_to_duration,
    effective_fps,
    frame_duration,
    frame_to_time,
    step_frame,
    time_to_frame,
    VIEWER_FALLBACK_FPS,
} from "./viewer-step"

describe("effective_fps", () => {
    it.each([
        [null, 30],
        [undefined, 30],
        [Number.NaN, 30],
        [0, 30],
        [-1, 30],
        [Number.POSITIVE_INFINITY, 30],
    ])("falls back to 30 for %s", (probe_fps: number | null | undefined, want: number) => {
        expect(effective_fps(probe_fps)).toBe(want)
    })

    it("passes through finite positive fps including 29.97", () => {
        expect(VIEWER_FALLBACK_FPS).toBe(30)
        expect(effective_fps(24)).toBe(24)
        expect(effective_fps(29.97)).toBeCloseTo(29.97, 6)
    })
})

describe("frame_duration", () => {
    it("returns 1/fps for 30 fps", () => {
        expect(frame_duration(30)).toBeCloseTo(1 / 30, 10)
    })

    it("rejects non-finite and non-positive fps", () => {
        for (const fps of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => frame_duration(fps)).toThrow("Invalid fps")
        }
    })
})

describe("time_to_frame and frame_to_time", () => {
    it("maps frame boundaries with epsilon without tipping early", () => {
        expect(time_to_frame(0, 30)).toBe(0)
        // One frame below the exact 1-frame time still counts as frame 0.
        expect(time_to_frame(1 / 30 - 1e-7, 30)).toBe(0)
        expect(time_to_frame(1 / 30, 30)).toBe(1)
        expect(time_to_frame(2.5, 25)).toBe(62)
    })

    it("clamps negative and non-finite frames to zero time", () => {
        expect(frame_to_time(-1, 30)).toBe(0)
        expect(frame_to_time(Number.NaN, 30)).toBe(0)
        expect(frame_to_time(30, 30)).toBeCloseTo(1, 10)
    })
})

describe("clamp_to_duration", () => {
    it.each([
        [5, null, 5],
        [5, undefined, 5],
        [5, Number.NaN, 5],
        [5, Number.POSITIVE_INFINITY, 5],
        [12, 10, 10],
        [-3, 10, 0],
        [5, 0, 0],
    ])("clamps %s with duration %s to %s", (time_s: number, duration: number | null | undefined, want: number) => {
        expect(clamp_to_duration(time_s, duration)).toBe(want)
    })
})

describe("step_frame", () => {
    it("steps one frame forward/back and round-trips, then clamps at bounds", () => {
        expect(step_frame(1, 30, 1, null)).toBeCloseTo(31 / 30, 3)
        expect(step_frame(1, 30, -1, null)).toBeCloseTo(29 / 30, 3)
        // Round-trip: stepping +1 then -1 returns to the quantized start.
        const forward = step_frame(1, 30, 1, null)
        expect(step_frame(forward, 30, -1, null)).toBeCloseTo(1, 3)
        // Lower bound clamps at 0; upper bound clamps at duration.
        expect(step_frame(0, 30, -1, null)).toBe(0)
        expect(step_frame(9.99, 30, 5, 10)).toBe(10)
    })

    it("returns exact frame time without millisecond quantize", () => {
        expect(step_frame(0, 29.97, 1, null)).toBeCloseTo(1 / 29.97, 10)
    })
})
