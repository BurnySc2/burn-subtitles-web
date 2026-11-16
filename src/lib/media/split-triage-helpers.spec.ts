import { describe, expect, it } from "vitest"
import type { SubtitleCue } from "./compose-subtitles"
import { cps, is_long, truncate } from "./split-triage-helpers"

function cue(text: string, start: number, end: number): SubtitleCue {
    return { index: 1, start, end, text }
}

describe("cps", () => {
    it("ignores line breaks when measuring length", () => {
        expect(cps(cue("ab\ncd", 0, 2))).toBeCloseTo(2, 6)
    })

    it("clamps zero and negative durations to 0.1s", () => {
        expect(cps(cue("abcd", 1, 1))).toBeCloseTo(40, 6)
        expect(cps(cue("abcd", 2, 1))).toBeCloseTo(40, 6)
    })
})

describe("is_long", () => {
    it("counts code points so 41 emoji are not long by UTF-16 length", () => {
        const emoji = "😀".repeat(41)
        expect(emoji.length).toBe(82)
        expect(is_long(cue(emoji, 0, 2))).toBe(false)
    })

    it.each([
        ["a".repeat(80), false],
        ["a".repeat(81), true],
    ])("boundary 80 chars: long is %s", (text: string, want: boolean) => {
        expect(is_long(cue(text, 0, 2))).toBe(want)
    })

    it("honors a custom budget", () => {
        expect(is_long(cue("abcde", 0, 2), 5)).toBe(false)
        expect(is_long(cue("abcdef", 0, 2), 5)).toBe(true)
    })
})

describe("truncate", () => {
    it("returns short and exact-length text unchanged", () => {
        expect(truncate("abc", 5)).toBe("abc")
        expect(truncate("a".repeat(80))).toBe("a".repeat(80))
    })

    it("appends an ellipsis to long text", () => {
        expect(truncate("a".repeat(81))).toBe(`${"a".repeat(80)}…`)
    })

    it("never splits surrogate pairs", () => {
        const result = truncate(`a${"😀".repeat(5)}b`, 3)
        expect(result).toBe(`a${"😀".repeat(2)}…`)
        expect(Array.from(result.replace("…", "")).length).toBeLessThanOrEqual(3)
    })
})
