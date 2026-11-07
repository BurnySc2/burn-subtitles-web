import { describe, expect, it } from "vitest"
import { clamp_gap, DEFAULT_GAP_MS, quantize_cs, split_times } from "./split-timing"

describe("quantize_cs", () => {
    it.each([
        [1.234, 1.23],
        [1.235, 1.24],
    ])("quantizes %s to %s", (raw: number, want: number) => {
        expect(quantize_cs(raw)).toBe(want)
    })
})

describe("clamp_gap", () => {
    it.each([
        [-5, 0],
        [999, 500],
        [80, 80],
    ])("clamps %s to %s", (raw: number, want: number) => {
        expect(clamp_gap(raw)).toBe(want)
    })

    it("falls back to default gap for non-finite input", () => {
        expect(clamp_gap(NaN)).toBe(DEFAULT_GAP_MS)
        expect(clamp_gap(NaN)).toBe(10)
    })
})

describe("split_times", () => {
    it("applies a symmetric gap around the midpoint", () => {
        const { end_a, start_b } = split_times(0, 10, 0.5, 80)
        expect(end_a).toBeCloseTo(4.96, 6)
        expect(start_b).toBeCloseTo(5.04, 6)
        expect(start_b - end_a).toBeCloseTo(0.08, 6)
    })

    it("collapses to a single point when duration cannot fit gap plus minimum parts", () => {
        const { end_a, start_b } = split_times(0, 0.3, 0.5, 80)
        expect(end_a).toBe(start_b)
    })

    it("defaults gap to DEFAULT_GAP_MS", () => {
        expect(split_times(0, 10, 0.5)).toEqual(split_times(0, 10, 0.5, 10))
        expect(split_times(0, 10, 0.5)).toEqual(split_times(0, 10, 0.5, DEFAULT_GAP_MS))
    })
})
