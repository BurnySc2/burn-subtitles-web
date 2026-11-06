import { describe, expect, it } from "vitest"
import type { OverlayPosition, TextItem } from "./compose-types"
import { ClipError } from "./mediabunny-clip"
import type { RenderTextOverlayOptions } from "./mediabunny-text-overlay"
import {
    animated_text_key,
    is_animated_text,
    item_alpha,
    MAX_TEXT_ITEMS,
    resolve_text_anchor,
    text_size_at,
    validate_text_options,
} from "./mediabunny-text-overlay"

const base_item = (override: Partial<TextItem> = {}): TextItem => ({
    text: "Hello",
    font: "sans-serif",
    size_start: 48,
    size_end: 48,
    color: "#ffffff",
    opacity: 0.8,
    anchor: "center",
    offset_x: 0,
    offset_y: 0,
    align: "center",
    max_width: null,
    show_start: 1,
    show_end: 5,
    fade_in: 0,
    fade_out: 0,
    ...override,
})

const base_options = (override: Partial<RenderTextOverlayOptions> = {}): RenderTextOverlayOptions => ({
    video: new File(["x"], "clip.mp4", { type: "video/mp4" }),
    items: [base_item()],
    width: 1280,
    height: 720,
    fps: 30,
    quality: "medium",
    ...override,
})

describe("animated_text_key", () => {
    it("is stable for identical inputs", () => {
        const item = base_item({ size_start: 40, size_end: 80 })
        expect(animated_text_key(0, item)).toBe(animated_text_key(0, base_item({ size_start: 40, size_end: 80 })))
    })

    it("gives distinct keys when text, align, max_width, or size_start differ", () => {
        const base = base_item({
            text: "Hello",
            font: "sans-serif",
            size_start: 40,
            size_end: 80,
            color: "#ffffff",
            align: "center",
            max_width: null,
        })
        const key = animated_text_key(0, base)
        const variants: TextItem[] = [
            base_item({ ...base, text: "World" }),
            base_item({ ...base, align: "left" }),
            base_item({ ...base, max_width: 200 }),
            base_item({ ...base, size_start: 30 }),
        ]
        for (const variant of variants) {
            expect(animated_text_key(0, variant)).not.toBe(key)
        }
    })

    it("distinguishes a shrink (80->40) from items sharing the same end size", () => {
        const shrink = base_item({ size_start: 80, size_end: 40 })
        expect(is_animated_text(shrink)).toBe(true)
        expect(animated_text_key(0, shrink)).not.toBe(animated_text_key(0, base_item({ size_start: 20, size_end: 40 })))
        expect(animated_text_key(0, shrink)).not.toBe(animated_text_key(0, base_item({ size_start: 40, size_end: 40 })))
    })
})

describe("item_alpha", () => {
    it("returns 0 outside the window and opacity in the middle", () => {
        const item = base_item({ show_start: 1, show_end: 5, opacity: 0.8 })
        expect(item_alpha(item, 0.999)).toBe(0)
        expect(item_alpha(item, 5.001)).toBe(0)
        expect(item_alpha(item, 3)).toBe(0.8)
    })

    it("returns 0 outside an open-ended window", () => {
        const item = base_item({ show_start: 2, show_end: null, opacity: 0.5 })
        expect(item_alpha(item, 1.999)).toBe(0)
        expect(item_alpha(item, 100)).toBe(0.5)
    })

    it("ramps fade_in linearly from the window start", () => {
        const item = base_item({ show_start: 1, show_end: 5, opacity: 1, fade_in: 2 })
        expect(item_alpha(item, 1)).toBe(0)
        expect(item_alpha(item, 2)).toBeCloseTo(0.5, 6)
        expect(item_alpha(item, 3)).toBe(1)
    })

    it("ramps fade_out linearly toward the window end", () => {
        const item = base_item({ show_start: 1, show_end: 5, opacity: 1, fade_out: 2 })
        expect(item_alpha(item, 3)).toBe(1)
        expect(item_alpha(item, 4)).toBeCloseTo(0.5, 6)
        expect(item_alpha(item, 5)).toBe(0)
    })

    it("scales both ramps by opacity and clamps to [0, opacity]", () => {
        const item = base_item({ show_start: 1, show_end: 5, opacity: 0.4, fade_in: 2, fade_out: 2 })
        expect(item_alpha(item, 2)).toBeCloseTo(0.2, 6)
        expect(item_alpha(item, 3)).toBe(0.4)
        expect(item_alpha(item, 4)).toBeCloseTo(0.2, 6)
        for (const t of [0, 0.5, 1, 2, 3, 4, 5, 6]) {
            const alpha = item_alpha(item, t)
            expect(alpha).toBeGreaterThanOrEqual(0)
            expect(alpha).toBeLessThanOrEqual(0.4)
        }
    })
})

describe("resolve_text_anchor", () => {
    const width = 1280
    const height = 720

    it("maps all nine anchors with zero offsets", () => {
        const cases: Array<[OverlayPosition, number, number]> = [
            ["top-left", 0, 0],
            ["top-center", 640, 0],
            ["top-right", 1280, 0],
            ["center-left", 0, 360],
            ["center", 640, 360],
            ["center-right", 1280, 360],
            ["bottom-left", 0, 720],
            ["bottom-center", 640, 720],
            ["bottom-right", 1280, 720],
        ]
        for (const [anchor, x, y] of cases) {
            expect(resolve_text_anchor(anchor, width, height, 0, 0)).toEqual({ x, y })
        }
    })

    it("applies signed offsets outward from each edge", () => {
        expect(resolve_text_anchor("top-left", width, height, 10, 20)).toEqual({ x: 10, y: 20 })
        expect(resolve_text_anchor("top-left", width, height, -10, -20)).toEqual({ x: 0, y: 0 })
        expect(resolve_text_anchor("bottom-right", width, height, 10, 20)).toEqual({ x: 1270, y: 700 })
        expect(resolve_text_anchor("center", width, height, 15, -25)).toEqual({ x: 655, y: 335 })
        expect(resolve_text_anchor("top-center", width, height, -30, 40)).toEqual({ x: 610, y: 40 })
        expect(resolve_text_anchor("center-left", width, height, 12, -8)).toEqual({ x: 12, y: 352 })
    })

    it("clamps results to [0, W] x [0, H]", () => {
        expect(resolve_text_anchor("top-left", width, height, 5000, 5000)).toEqual({ x: 1280, y: 720 })
        expect(resolve_text_anchor("bottom-right", width, height, 5000, 5000)).toEqual({ x: 0, y: 0 })
        expect(resolve_text_anchor("center", width, height, -5000, 5000)).toEqual({ x: 0, y: 720 })
    })
})

describe("text_size_at", () => {
    it("interpolates linearly with the midpoint halfway", () => {
        const item = base_item({ show_start: 2, show_end: 6, size_start: 40, size_end: 80 })
        expect(text_size_at(item, 2, 1080)).toBe(40)
        expect(text_size_at(item, 4, 1080)).toBe(60)
        expect(text_size_at(item, 6, 1080)).toBe(80)
    })

    it("returns size_start for null end", () => {
        const item = base_item({ show_start: 2, show_end: null, size_start: 40, size_end: 80 })
        expect(text_size_at(item, 2, 1080)).toBe(40)
        expect(text_size_at(item, 100, 1080)).toBe(40)
    })

    it("scales by out_h over 1080", () => {
        const item = base_item({ show_start: 0, show_end: 4, size_start: 40, size_end: 80 })
        expect(text_size_at(item, 2, 540)).toBe(30)
        expect(text_size_at(item, 2, 2160)).toBe(120)
    })

    it("clamps progress outside the window", () => {
        const item = base_item({ show_start: 2, show_end: 6, size_start: 40, size_end: 80 })
        expect(text_size_at(item, 0, 1080)).toBe(40)
        expect(text_size_at(item, 100, 1080)).toBe(80)
    })

    it("preserves fractional sizes at the midpoint", () => {
        const item = base_item({ show_start: 2, show_end: 6, size_start: 25, size_end: 26 })
        const size = text_size_at(item, 4, 1080)
        expect(size).toBeCloseTo(25.5, 6)
        expect(size % 1).not.toBe(0)
    })

    it("yields fractional per-frame values for a small delta", () => {
        const item = base_item({ show_start: 0, show_end: 5, size_start: 25, size_end: 30 })
        const size = text_size_at(item, 1 / 30, 1080)
        expect(size).toBeCloseTo(25.033_333, 5)
        expect(size % 1).not.toBe(0)
    })
})

describe("validate_text_options", () => {
    it("accepts a well-formed single item", () => {
        expect(() => validate_text_options(base_options())).not.toThrow()
    })

    it("rejects bad width, fps, quality, and crf with INVALID_RANGE", () => {
        const bad: Array<Partial<RenderTextOverlayOptions>> = [
            { width: 0 },
            { width: 1280.5 },
            { height: -720 },
            { fps: 0 },
            { fps: Number.NaN },
            { quality: "extreme" as RenderTextOverlayOptions["quality"] },
            { crf: -1 },
            { crf: 52 },
            { crf: "abc" },
        ]
        for (const override of bad) {
            try {
                validate_text_options(base_options(override))
                expect.unreachable(`expected INVALID_RANGE for ${JSON.stringify(override)}`)
            } catch (error) {
                expect(error).toBeInstanceOf(ClipError)
                expect((error as ClipError).code).toBe("INVALID_RANGE")
            }
        }
    })

    it("rejects a non-file video and empty item list", () => {
        expect(() => validate_text_options(base_options({ video: "clip.mp4" as unknown as File }))).toThrow(ClipError)
        expect(() => validate_text_options(base_options({ items: [] }))).toThrow(ClipError)
    })

    it("rejects empty text, bad anchor, and bad align with INVALID_RANGE", () => {
        const bad_items: Array<Partial<TextItem>> = [
            { text: "" },
            { anchor: "middle" as OverlayPosition },
            { align: "justify" as TextItem["align"] },
        ]
        for (const override of bad_items) {
            try {
                validate_text_options(base_options({ items: [base_item(override)] }))
                expect.unreachable(`expected INVALID_RANGE for ${JSON.stringify(override)}`)
            } catch (error) {
                expect(error).toBeInstanceOf(ClipError)
                expect((error as ClipError).code).toBe("INVALID_RANGE")
            }
        }
    })

    it("rejects end at or before start with INVALID_RANGE", () => {
        for (const show_end of [1, 0.5]) {
            expect(() =>
                validate_text_options(base_options({ items: [base_item({ show_start: 1, show_end })] })),
            ).toThrow(expect.objectContaining({ code: "INVALID_RANGE" }))
        }
    })

    it("rejects negative fades with INVALID_RANGE", () => {
        expect(() => validate_text_options(base_options({ items: [base_item({ fade_in: -0.5 })] }))).toThrow(
            expect.objectContaining({ code: "INVALID_RANGE" }),
        )
        expect(() => validate_text_options(base_options({ items: [base_item({ fade_out: -1 })] }))).toThrow(
            expect.objectContaining({ code: "INVALID_RANGE" }),
        )
    })

    it("rejects a fade sum longer than the window with INVALID_RANGE", () => {
        expect(() =>
            validate_text_options(
                base_options({ items: [base_item({ show_start: 1, show_end: 3, fade_in: 1.5, fade_out: 1.5 })] }),
            ),
        ).toThrow(expect.objectContaining({ code: "INVALID_RANGE" }))
    })

    it("rejects whitespace-only text and non-hex colors with INVALID_RANGE", () => {
        const bad_items: Array<Partial<TextItem>> = [
            { text: "   " },
            { text: " \t\n " },
            { color: "red" },
            { color: "#fff" },
            { color: "#ffffff00" },
            { color: " #ffffff" },
            { color: "#gggggg" },
        ]
        for (const override of bad_items) {
            try {
                validate_text_options(base_options({ items: [base_item(override)] }))
                expect.unreachable(`expected INVALID_RANGE for ${JSON.stringify(override)}`)
            } catch (error) {
                expect(error).toBeInstanceOf(ClipError)
                expect((error as ClipError).code).toBe("INVALID_RANGE")
            }
        }
    })

    it("accepts lowercase and uppercase 6-digit hex colors", () => {
        for (const color of ["#ffffff", "#ABCDEF", "#a1b2c3"]) {
            expect(() => validate_text_options(base_options({ items: [base_item({ color })] }))).not.toThrow()
        }
    })

    it("rejects more than MAX_TEXT_ITEMS with INVALID_RANGE", () => {
        const items = Array.from({ length: MAX_TEXT_ITEMS + 1 }, () => base_item())
        expect(() => validate_text_options(base_options({ items }))).toThrow(
            expect.objectContaining({ code: "INVALID_RANGE" }),
        )
        expect(() => validate_text_options(base_options({ items: items.slice(0, MAX_TEXT_ITEMS) }))).not.toThrow()
    })
})
