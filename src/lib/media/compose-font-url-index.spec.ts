import { beforeEach, describe, expect, it, vi } from "vitest"
import {
    clear_font_url_index,
    get_font_url_auto_restore,
    load_font_url_index,
    remove_font_url_entry,
    save_font_url_entry,
    set_font_url_auto_restore,
} from "./compose-font-url-index"

const STORAGE_KEY = "font_url_index"

function saved_family(index: number): string {
    return `Family ${index}`
}

function saved_url(index: number): string {
    return `https://example.com/font-${index}.woff2`
}

beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
})

describe("save_font_url_entry", () => {
    it("round-trips a saved entry through load", () => {
        save_font_url_entry({ family: "Test Font", origin_url: "https://example.com/font.woff2" })

        const loaded = load_font_url_index()
        expect(loaded.entries).toHaveLength(1)
        expect(loaded.entries[0]?.family).toBe("Test Font")
        expect(loaded.entries[0]?.origin_url).toBe("https://example.com/font.woff2")
    })

    it("overwrites the existing entry when the family matches ignoring case", () => {
        save_font_url_entry({ family: "My Font", origin_url: "https://example.com/a.woff2" })
        save_font_url_entry({ family: "my FONT", origin_url: "https://example.com/b.woff2" })

        const loaded = load_font_url_index()
        expect(loaded.entries).toHaveLength(1)
        expect(loaded.entries[0]?.origin_url).toBe("https://example.com/b.woff2")
    })

    it.each([
        "not-a-url",
        "",
        "ftp://example.com/font.woff2",
        "data:font/woff2;base64,AAA",
    ])("ignores invalid url %s", (origin_url: string) => {
        save_font_url_entry({ family: "Bad Font", origin_url })

        expect(load_font_url_index().entries).toHaveLength(0)
    })

    it("evicts the oldest entry when saving a 21st entry", () => {
        for (let index = 0; index < 21; index += 1) {
            save_font_url_entry({ family: saved_family(index), origin_url: saved_url(index) })
        }

        const loaded = load_font_url_index()
        expect(loaded.entries).toHaveLength(20)
        expect(loaded.entries.map((entry) => entry.family)).not.toContain(saved_family(0))
        expect(loaded.entries.map((entry) => entry.family)).toContain(saved_family(20))
    })

    it("does not throw when storage quota is exceeded", () => {
        const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
            throw new DOMException("Quota exceeded", "QuotaExceededError")
        })
        try {
            expect(() => {
                save_font_url_entry({ family: "Quota Font", origin_url: "https://example.com/quota.woff2" })
            }).not.toThrow()
        } finally {
            spy.mockRestore()
        }

        expect(load_font_url_index()).toEqual({ entries: [], auto_restore_enabled: true })
    })
})

describe("remove_font_url_entry", () => {
    it("removes entries case-insensitively and trims the input", () => {
        save_font_url_entry({ family: "My Font", origin_url: "https://example.com/a.woff2" })
        remove_font_url_entry("  MY FONT  ")

        expect(load_font_url_index().entries).toHaveLength(0)
    })
})

describe("clear_font_url_index", () => {
    it("empties entries but preserves the auto-restore toggle", () => {
        set_font_url_auto_restore(false)
        save_font_url_entry({ family: "Kept Toggle", origin_url: "https://example.com/kept.woff2" })
        clear_font_url_index()

        const loaded = load_font_url_index()
        expect(loaded.entries).toHaveLength(0)
        expect(loaded.auto_restore_enabled).toBe(false)
    })
})

describe("font url auto restore", () => {
    it("round-trips set and get with a true default", () => {
        expect(get_font_url_auto_restore()).toBe(true)

        set_font_url_auto_restore(false)
        expect(get_font_url_auto_restore()).toBe(false)

        set_font_url_auto_restore(true)
        expect(get_font_url_auto_restore()).toBe(true)
    })
})

describe("load_font_url_index", () => {
    it.each([
        "{oops",
        "null",
        "[1,2]",
        '"just a string"',
    ])("falls back to a safe default for corrupt json %s", (raw: string) => {
        localStorage.setItem(STORAGE_KEY, raw)

        expect(load_font_url_index()).toEqual({ entries: [], auto_restore_enabled: true })
    })
})
