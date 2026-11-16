import { describe, expect, it } from "vitest"
import { build_envelope, type LoudnessCache, loudness_at, peak_to_dbfs } from "./viewer-loudness"

function make_cache(peaks: number[], rms: number[], duration_s = 4, buckets_per_sec = 1): LoudnessCache {
    return {
        duration_s,
        sample_rate: 48000,
        buckets_per_sec,
        peaks: new Float32Array(peaks),
        rms: new Float32Array(rms),
        peak_overall: Math.max(0, ...peaks),
        rms_overall: 0,
        computed_at: 0,
    }
}

describe("build_envelope", () => {
    it("splits samples into peak and rms buckets", () => {
        const { peaks, rms } = build_envelope(new Float32Array([0, 1, 0, -1]), 2)
        expect([...peaks]).toEqual([1, 1])
        expect(rms[0]).toBeCloseTo(Math.SQRT1_2, 6)
        expect(rms[1]).toBeCloseTo(Math.SQRT1_2, 6)
    })

    it("returns silence buckets for empty input", () => {
        const { peaks, rms } = build_envelope(new Float32Array(0), 3)
        expect([...peaks]).toEqual([0, 0, 0])
        expect([...rms]).toEqual([0, 0, 0])
    })

    it("returns empty envelope for non-positive bucket count", () => {
        const { peaks, rms } = build_envelope(new Float32Array([0.5, -0.5]), 0)
        expect(peaks.length).toBe(0)
        expect(rms.length).toBe(0)
    })
})

describe("peak_to_dbfs", () => {
    it("maps full scale to 0 dBFS and halves to about -6 dBFS", () => {
        expect(peak_to_dbfs(1)).toBeCloseTo(0, 10)
        expect(peak_to_dbfs(0.5)).toBeCloseTo(-6.0206, 3)
    })

    it("maps silence and invalid peaks to negative infinity", () => {
        expect(peak_to_dbfs(0)).toBe(Number.NEGATIVE_INFINITY)
        expect(peak_to_dbfs(-1)).toBe(Number.NEGATIVE_INFINITY)
        expect(peak_to_dbfs(Number.NaN)).toBe(Number.NEGATIVE_INFINITY)
    })
})

describe("loudness_at", () => {
    it("returns null for missing or empty caches", () => {
        expect(loudness_at(null, 1)).toBeNull()
        expect(loudness_at(undefined, 1)).toBeNull()
        expect(loudness_at(make_cache([], []), 1)).toBeNull()
    })

    it("returns the bucket peak at the requested time", () => {
        const cache = make_cache([0.25, 0.5, 1, 0.125], [0.1, 0.2, 0.4, 0.05])
        const point = loudness_at(cache, 2.5)
        expect(point?.peak).toBeCloseTo(1, 6)
        expect(point?.rms).toBeCloseTo(0.4, 6)
        expect(point?.dbfs).toBeCloseTo(0, 10)
    })

    it("aggregates peak max and rms energy over a window", () => {
        const cache = make_cache([0.5, 1, 0.25, 0.25], [0.5, 0.5, 0.25, 0.25])
        const point = loudness_at(cache, 1, 2)
        expect(point?.peak).toBeCloseTo(1, 6)
        expect(point?.rms).toBeCloseTo(Math.sqrt((0.25 + 0.25) / 2), 6)
        expect(point?.dbfs).toBeCloseTo(0, 10)
    })
})
