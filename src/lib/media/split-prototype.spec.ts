import { describe, expect, it } from "vitest"
import type { SubtitleCue } from "./compose-subtitles"
import { alternative_split, apply_split, preview_parts, recommend_split } from "./split-prototype"

function make_cue(text: string): SubtitleCue {
    return { index: 1, start: 0, end: 1, text }
}

describe("recommend_split", () => {
    it("returns 0 for fewer than two words", () => {
        expect(recommend_split([])).toBe(0)
        expect(recommend_split(["Hello"])).toBe(0)
    })

    it("prefers a punctuation boundary over a balanced middle", () => {
        const words = ["Hello.", "this", "is", "a", "much", "longer", "sentence", "here"]
        expect(recommend_split(words)).toBe(1)
    })
})

describe("alternative_split", () => {
    it("returns an index distinct from recommended and within bounds", () => {
        const words = ["one", "two", "three", "four", "five", "six", "seven", "eight"]
        const recommended = recommend_split(words)
        const other = alternative_split(words, recommended)
        expect(other).toBeGreaterThanOrEqual(1)
        expect(other).toBeLessThanOrEqual(words.length - 1)
        expect(other).not.toBe(recommended)
    })

    it("returns 0 for fewer than two words", () => {
        expect(alternative_split([], 0)).toBe(0)
        expect(alternative_split(["Hello"], 0)).toBe(0)
    })
})

describe("preview_parts", () => {
    it("passes custom parts through untouched", () => {
        const cue = make_cue("hello world foo bar")
        expect(preview_parts(cue, "recommended", ["a", "b"], "en")).toEqual(["a", "b"])
    })

    it("returns single-word cues as one part", () => {
        expect(preview_parts(make_cue("Hello"), "recommended", undefined, "en")).toEqual(["Hello"])
    })
})

describe("apply_split", () => {
    it("preserves a trailing comma on the head part", () => {
        expect(apply_split("Hello, world foo bar", 2, "en")).toEqual(["Hello,", "world foo bar"])
    })

    it("clamps out-of-range split indexes into bounds", () => {
        expect(apply_split("a b c d", 0, "en")).toEqual(["a", "b c d"])
        expect(apply_split("a b c d", 99, "en")).toEqual(["a b c", "d"])
    })

    it("returns single words untouched and defaults to en locale", () => {
        expect(apply_split("Hello", 5)).toEqual(["Hello"])
        expect(apply_split("Hello world foo", 2)).toEqual(apply_split("Hello world foo", 2, "en"))
    })
})
