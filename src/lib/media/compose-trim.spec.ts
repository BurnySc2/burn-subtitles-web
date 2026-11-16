import { describe, expect, it } from "vitest"
import { parse_trim_field, resolve_trim_range } from "./compose-trim"

describe("resolve_trim_range", () => {
    it("rejects both-empty", () => {
        expect(resolve_trim_range({ start: null, end: null }, 10)).toEqual({ ok: false, reason: "both-empty" })
    })

    it("defaults null start to 0", () => {
        expect(resolve_trim_range({ start: null, end: 5 }, null)).toEqual({ ok: true, start: 0, end: 5 })
    })

    it("defaults null end to upstream duration", () => {
        expect(resolve_trim_range({ start: 2, end: null }, 10)).toEqual({ ok: true, start: 2, end: 10 })
    })

    it("rejects null end without duration", () => {
        expect(resolve_trim_range({ start: 0, end: null }, null)).toEqual({ ok: false, reason: "no-duration" })
    })

    it("rejects 0/0", () => {
        expect(resolve_trim_range({ start: 0, end: 0 }, 10)).toEqual({ ok: false, reason: "invalid-range" })
    })

    it("rejects end before start", () => {
        expect(resolve_trim_range({ start: 5, end: 3 }, 10)).toEqual({ ok: false, reason: "invalid-range" })
    })

    it("rejects negative start", () => {
        expect(resolve_trim_range({ start: -1, end: 5 }, 10)).toEqual({ ok: false, reason: "invalid-range" })
    })

    it("rejects NaN", () => {
        expect(resolve_trim_range({ start: Number.NaN, end: 5 }, 10)).toEqual({ ok: false, reason: "invalid-range" })
    })
})

describe("parse_trim_field", () => {
    it("parses empty string to null", () => {
        expect(parse_trim_field("")).toBeNull()
    })

    it("parses blank string to null", () => {
        expect(parse_trim_field("  ")).toBeNull()
    })

    it("parses decimal string", () => {
        expect(parse_trim_field("1.5")).toBe(1.5)
    })

    it("parses non-numeric to undefined", () => {
        expect(parse_trim_field("abc")).toBeUndefined()
    })

    it("parses Infinity to undefined", () => {
        expect(parse_trim_field("Infinity")).toBeUndefined()
    })
})
