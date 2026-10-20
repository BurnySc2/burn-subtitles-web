import { describe, expect, it } from "vitest"
import { clamp_timecode, format_timecode, parse_timecode, TimecodeError } from "./timecode"

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
