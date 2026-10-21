import { describe, expect, it } from "vitest"
import { parse_srt, SubtitleError, srt_to_vtt, validate_srt, vtt_to_srt } from "./compose-subtitles"

const SAMPLE_SRT =
    "1\n00:00:01,000 --> 00:00:02,500\nHello world\n\n2\n00:01:02,250 --> 00:01:04,000\nSecond line\nsplit across two\n"

describe("parse_srt", () => {
    it("parses cues with second-precision timestamps and multiline text", () => {
        const cues = parse_srt(SAMPLE_SRT)
        expect(cues).toHaveLength(2)
        expect(cues[0]).toEqual({ index: 1, start: 1, end: 2.5, text: "Hello world" })
        expect(cues[1].start).toBeCloseTo(62.25, 6)
        expect(cues[1].text).toBe("Second line\nsplit across two")
    })

    it("returns an empty array for empty input", () => {
        expect(parse_srt("")).toEqual([])
        expect(parse_srt("  \n\n ")).toEqual([])
    })

    it("throws SubtitleError on malformed blocks and inverted ranges", () => {
        expect(() => parse_srt("1\nnot-a-stamp\ntext\n")).toThrow(SubtitleError)
        expect(() => parse_srt("1\n00:00:02,000 --> 00:00:01,000\ntext\n")).toThrow(
            "end time must be greater than start time",
        )
        expect(() => parse_srt("1\n00:00:01,000 --> 00:00:02,000\n")).toThrow(SubtitleError)
    })
})

describe("srt_to_vtt", () => {
    it("emits a WEBVTT header with dot separators", () => {
        expect(srt_to_vtt("1\n00:00:01,000 --> 00:00:02,500\nHi\n")).toBe(
            "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHi\n",
        )
    })

    it("escapes markup-significant characters so cue text stays literal", () => {
        const vtt = srt_to_vtt("1\n00:00:01,000 --> 00:00:02,000\nA <b>bold</b> & friend\n")
        expect(vtt).toContain("A &lt;b&gt;bold&lt;/b&gt; &amp; friend")
    })

    it("returns a bare header for empty input", () => {
        expect(srt_to_vtt("")).toBe("WEBVTT\n")
    })
})

describe("vtt_to_srt", () => {
    it("renumbers cues with comma separators and unescapes entities", () => {
        const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nA &lt;b&gt;bold&lt;/b&gt; &amp; friend\n"
        expect(vtt_to_srt(vtt)).toBe("1\n00:00:01,000 --> 00:00:02,500\nA <b>bold</b> & friend\n")
    })

    it("skips NOTE, STYLE, cue identifiers, and cue settings", () => {
        const vtt = [
            "WEBVTT",
            "",
            "NOTE this is a comment",
            "spanning lines",
            "",
            "STYLE",
            "::cue { color: white }",
            "",
            "intro",
            "00:01.000 --> 00:02.000 position:10%,line-left align:left",
            "Hello",
            "",
        ].join("\n")
        expect(vtt_to_srt(vtt)).toBe("1\n00:00:01,000 --> 00:00:02,000\nHello\n")
    })

    it("returns an empty string when no cues remain", () => {
        expect(vtt_to_srt("WEBVTT\n")).toBe("")
    })

    it("round-trips srt to vtt and back without loss", () => {
        expect(vtt_to_srt(srt_to_vtt(SAMPLE_SRT))).toBe(SAMPLE_SRT)
    })
})

describe("validate_srt", () => {
    it("accepts a well-formed file", () => {
        expect(validate_srt(SAMPLE_SRT)).toEqual({ valid: true, errors: [] })
    })

    it("reports empty input, bad numbering, dot separators, and inverted ranges", () => {
        expect(validate_srt("").valid).toBe(false)
        const numbered = validate_srt("2\n00:00:01,000 --> 00:00:02,000\nHi\n")
        expect(numbered.valid).toBe(false)
        expect(numbered.errors.join(" ")).toContain("cue number 1")
        const dotted = validate_srt("1\n00:00:01.000 --> 00:00:02.000\nHi\n")
        expect(dotted.valid).toBe(false)
        expect(dotted.errors.join(" ")).toContain("comma")
        const inverted = validate_srt("1\n00:00:02,000 --> 00:00:01,000\nHi\n")
        expect(inverted.valid).toBe(false)
        expect(inverted.errors.join(" ")).toContain("greater than start")
    })
})
