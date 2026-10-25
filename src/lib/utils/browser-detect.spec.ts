import { describe, expect, it } from "vitest"
import { is_chromium } from "./browser-detect"

describe("is_chromium", () => {
    it("detects Chromium via userAgentData brands", () => {
        expect(is_chromium({ userAgentData: { brands: [{ brand: "Chromium" }] } })).toBe(true)
    })

    it("detects Chrome via userAgent", () => {
        expect(
            is_chromium({
                userAgent:
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            }),
        ).toBe(true)
    })

    it("detects Edge via userAgent", () => {
        expect(
            is_chromium({
                userAgent:
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
            }),
        ).toBe(true)
    })

    it("rejects Safari userAgent", () => {
        expect(
            is_chromium({
                userAgent:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
            }),
        ).toBe(false)
    })

    it("rejects Firefox userAgent", () => {
        expect(
            is_chromium({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
            }),
        ).toBe(false)
    })

    it("returns false for empty probe without throwing", () => {
        expect(is_chromium({})).toBe(false)
    })
})
