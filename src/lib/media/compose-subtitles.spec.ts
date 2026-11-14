import { describe, expect, it } from "vitest"
import {
    active_cues_at,
    clamp_number,
    HEX_RE,
    normalize_subtitle_style,
    parse_srt,
    resolve_burn_font_px,
    STRICT_HEX_6,
    SubtitleError,
    srt_to_vtt,
    validate_srt,
    vtt_to_srt,
} from "./compose-subtitles"
import { SUBTITLE_BURN_DEFAULTS } from "./compose-types"

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

describe("HEX_RE", () => {
    it.each(["#fff", "#FFF", "#abc", "#000000", "#ffff7f", "#ABCDEF"])("accepts %s", (hex) => {
        expect(HEX_RE.test(hex)).toBe(true)
    })

    it.each([
        "fff",
        "#ff",
        "#ffff",
        "#fffffff",
        "#ggg",
        "#12345g",
        "",
        "red",
        "#fff ",
        "##fff",
    ])("rejects %s", (hex) => {
        expect(HEX_RE.test(hex)).toBe(false)
    })
})

describe("STRICT_HEX_6", () => {
    it.each(["#000000", "#ffff7f", "#ABCDEF"])("accepts %s", (hex) => {
        expect(STRICT_HEX_6.test(hex)).toBe(true)
    })

    it.each(["#fff", "#FFF", "#abc", "fff", "#ff", "#ffff", "red", "#12345g"])("rejects %s", (hex) => {
        expect(STRICT_HEX_6.test(hex)).toBe(false)
    })
})

describe("normalize_subtitle_style", () => {
    it("returns burn defaults for an empty partial", () => {
        expect(normalize_subtitle_style({})).toEqual({ ...SUBTITLE_BURN_DEFAULTS })
    })

    it("falls back for bad colors, NaN sizes, and unknown anchor", () => {
        const style = normalize_subtitle_style({
            font_size: Number.NaN,
            text_color: "red",
            stroke_color: "#12345g",
            outline_size: Number.NaN,
            vertical_anchor: "middle" as never,
        })
        expect(style.font_size).toBe(SUBTITLE_BURN_DEFAULTS.font_size)
        expect(style.text_color).toBe(SUBTITLE_BURN_DEFAULTS.text_color)
        expect(style.stroke_color).toBe(SUBTITLE_BURN_DEFAULTS.stroke_color)
        expect(style.outline_size).toBe(SUBTITLE_BURN_DEFAULTS.outline_size)
        expect(style.vertical_anchor).toBe(SUBTITLE_BURN_DEFAULTS.vertical_anchor)
    })

    it("falls back for shorthand hex like #fff", () => {
        const style = normalize_subtitle_style({ text_color: "#fff", stroke_color: "#ABC" })
        expect(style.text_color).toBe(SUBTITLE_BURN_DEFAULTS.text_color)
        expect(style.stroke_color).toBe(SUBTITLE_BURN_DEFAULTS.stroke_color)
    })

    it("trims font_family and falls back for empty or overlong values", () => {
        expect(normalize_subtitle_style({ font_family: "  Roboto  " }).font_family).toBe("Roboto")
        expect(normalize_subtitle_style({ font_family: "   " }).font_family).toBe(SUBTITLE_BURN_DEFAULTS.font_family)
        expect(normalize_subtitle_style({}).font_family).toBe(SUBTITLE_BURN_DEFAULTS.font_family)
        expect(normalize_subtitle_style({ font_family: "a".repeat(250) }).font_family).toHaveLength(200)
    })

    it("keeps valid custom values", () => {
        const style = normalize_subtitle_style({ text_color: "#123abc", vertical_anchor: "top", font_size: 48 })
        expect(style.text_color).toBe("#123abc")
        expect(style.vertical_anchor).toBe("top")
        expect(style.font_size).toBe(48)
    })
})

describe("clamp_number", () => {
    it("clamps to min and max edges", () => {
        expect(clamp_number(-5, 0, 10)).toBe(0)
        expect(clamp_number(99, 0, 10)).toBe(10)
        expect(clamp_number(0, 0, 10)).toBe(0)
        expect(clamp_number(10, 0, 10)).toBe(10)
        expect(clamp_number(4, 0, 10)).toBe(4)
    })

    it("returns min for non-finite input", () => {
        expect(clamp_number(Number.NaN, 2, 10)).toBe(2)
        expect(clamp_number(Number.POSITIVE_INFINITY, 2, 10)).toBe(2)
        expect(clamp_number(Number.NEGATIVE_INFINITY, 2, 10)).toBe(2)
    })

    it("clamps style sizes through normalize_subtitle_style", () => {
        const style = normalize_subtitle_style({ font_size: 5000, outline_size: -3, shadow_size: 99 })
        expect(style.font_size).toBe(1000)
        expect(style.outline_size).toBe(0)
        expect(style.shadow_size).toBe(10)
    })
})

describe("active_cues_at", () => {
    const cues = [
        { index: 1, start: 1, end: 2.5, text: "Hello" },
        { index: 2, start: 2.5, end: 4, text: "World" },
    ]

    it("includes t == start and excludes t == end", () => {
        expect(active_cues_at(cues, 1).map((cue) => cue.index)).toEqual([1])
        expect(active_cues_at(cues, 2.5).map((cue) => cue.index)).toEqual([2])
        expect(active_cues_at(cues, 4)).toEqual([])
    })

    it("returns cues strictly inside the range and nothing outside", () => {
        expect(active_cues_at(cues, 2).map((cue) => cue.index)).toEqual([1])
        expect(active_cues_at(cues, 0.999)).toEqual([])
        expect(active_cues_at(cues, 9)).toEqual([])
    })

    it("returns [] for non-finite t", () => {
        expect(active_cues_at(cues, Number.NaN)).toEqual([])
        expect(active_cues_at(cues, Number.POSITIVE_INFINITY)).toEqual([])
        expect(active_cues_at(cues, Number.NEGATIVE_INFINITY)).toEqual([])
    })
})

describe("resolve_burn_font_px", () => {
    it("is identity at 1080p height", () => {
        expect(resolve_burn_font_px(24, 1080)).toBe(24)
    })

    it("halves at 540p height", () => {
        expect(resolve_burn_font_px(24, 540)).toBe(12)
    })

    it("falls back to the default size for invalid font sizes", () => {
        expect(resolve_burn_font_px(Number.NaN, 1080)).toBe(SUBTITLE_BURN_DEFAULTS.font_size)
        expect(resolve_burn_font_px(0, 1080)).toBe(SUBTITLE_BURN_DEFAULTS.font_size)
        expect(resolve_burn_font_px(-8, 1080)).toBe(SUBTITLE_BURN_DEFAULTS.font_size)
    })

    it("returns unscaled size for invalid heights and floors at 1px", () => {
        expect(resolve_burn_font_px(24, 0)).toBe(24)
        expect(resolve_burn_font_px(24, -5)).toBe(24)
        expect(resolve_burn_font_px(24, Number.NaN)).toBe(24)
        expect(resolve_burn_font_px(24, Number.POSITIVE_INFINITY)).toBe(24)
        expect(resolve_burn_font_px(1, 10)).toBe(1)
    })
})
