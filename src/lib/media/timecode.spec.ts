import { describe, expect, it } from "vitest"
import { clamp_timecode, format_timecode, parse_timecode, TimecodeError, validate_range } from "./timecode"

describe("parse_timecode", () => {
    it.each([
        ["00:00.000", 0],
        ["01:02.500", 62.5],
        ["  01:02.5  ", 62.5],
        ["00:00:00.000", 0],
        ["00:01:02.250", 62.25],
        ["1:02:03.4", 3723.4],
        ["00:00:01.25", 1.25],
    ])("parses %s as %s", (raw: string, want: number) => {
        expect(parse_timecode(raw)).toBeCloseTo(want, 6)
    })
})

describe("format_timecode and clamp_timecode", () => {
    it("zero-pads hh:mm:ss.mmm and clamps to [0, duration] with null unbounded", () => {
        for (const [seconds, want] of [
            [0, "00:00:00.000"],
            [62.5, "00:01:02.500"],
            [3723.456, "01:02:03.456"],
        ] as Array<[number, string]>) {
            expect(format_timecode(seconds)).toBe(want)
        }
        expect(clamp_timecode(-1, 5, 10)).toEqual({ start: 0, end: 5 })
        expect(clamp_timecode(2, 20, 10)).toEqual({ start: 2, end: 10 })
        expect(clamp_timecode(2, 5, null)).toEqual({ start: 2, end: 5 })
    })
})

describe("TimecodeError", () => {
    it("rejects out-of-range, malformed, and empty-range inputs", () => {
        for (const raw of ["00:60.000", "00:01:60.000", "not-a-time", "12", ""]) {
            expect(() => parse_timecode(raw)).toThrow(TimecodeError)
        }
        expect(() => clamp_timecode(5, 5, 10)).toThrow(TimecodeError)
        expect(() => clamp_timecode(5, 2, null)).toThrow(TimecodeError)
        expect(() => clamp_timecode(5, 2, null)).toThrow("End time must be greater than start time")
    })
})

describe("validate_range", () => {
    it("returns nulls for a valid range", () => {
        expect(validate_range("00:00:01.000", "00:00:02.000")).toEqual({
            start_error: null,
            end_error: null,
            range_error: null,
        })
    })

    it("reports range only when end is not after start", () => {
        const result = validate_range("00:00:05.000", "00:00:02.000")
        expect(result.start_error).toBeNull()
        expect(result.end_error).toBeNull()
        expect(result.range_error).toBe("End time must be greater than start time")
    })

    it("reports field only and suppresses range on bad input", () => {
        const result = validate_range("garbage", "00:00:02.000")
        expect(result.start_error).not.toBeNull()
        expect(result.end_error).toBeNull()
        expect(result.range_error).toBeNull()
    })
})
