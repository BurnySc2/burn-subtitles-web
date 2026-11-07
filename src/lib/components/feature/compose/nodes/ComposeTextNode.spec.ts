import { describe, expect, it } from "vitest"
import { create_default_text_item, MAX_TEXT_ITEMS, TEXT_ANCHORS, type TextItem } from "$lib/media/compose-types"

// Mirrors the row helpers in ComposeTextNode.svelte (truncate_preview,
// is_dimmed, visible_items slice(0, 2), overflow_count max(0, n - 2), summary,
// is_invalid, anchor-only row meta). Rename removed from the card;
// the inspector is the sole path.
// NOTE: the brief suggested ../../../media/compose-types, but from nodes/ that
// resolves to components/media (missing); $lib alias follows the
// ComposeOutputNode.spec.ts precedent (correct relative would be
// ../../../../media/compose-types).
function text_item(overrides: Partial<TextItem> = {}): TextItem {
    return { ...create_default_text_item(), ...overrides }
}

function truncate_preview(raw: string): string {
    const trimmed = raw.trim()
    return trimmed.length > 20 ? `${trimmed.slice(0, 20)}…` : trimmed
}

function is_dimmed(opacity: number): boolean {
    return opacity < 1
}

function visible_items(items: TextItem[]): TextItem[] {
    return items.slice(0, 2)
}

function overflow_count(items: TextItem[]): number {
    return Math.max(0, items.length - 2)
}

function summary(items: TextItem[]): string {
    return `${items.length} / ${MAX_TEXT_ITEMS}`
}

function is_invalid(items: TextItem[]): boolean {
    return (
        items.length === 0 ||
        items.length > MAX_TEXT_ITEMS ||
        items.some(
            (item) =>
                item.text.trim() === "" ||
                !/^#[0-9a-fA-F]{6}$/.test(item.color) ||
                !Number.isFinite(item.opacity) ||
                item.opacity < 0 ||
                item.opacity > 1 ||
                !TEXT_ANCHORS.includes(item.anchor),
        )
    )
}

function row_label(item: TextItem): string {
    if (item.text.trim() === "") {
        return "(empty)"
    }
    return truncate_preview(item.text)
}

function row_meta(item: TextItem): string {
    return item.anchor
}

function items_of(count: number): TextItem[] {
    return Array.from({ length: count }, () => text_item())
}

describe("ComposeTextNode rows", () => {
    it("caps visible rows at two with max(0, n - 2) overflow", () => {
        const cases: Array<[number, number, number]> = [
            [0, 0, 0],
            [1, 1, 0],
            [3, 2, 1],
            [MAX_TEXT_ITEMS, 2, MAX_TEXT_ITEMS - 2],
        ]
        for (const [count, want_visible, want_overflow] of cases) {
            const items = items_of(count)
            expect(visible_items(items)).toHaveLength(want_visible)
            expect(overflow_count(items)).toBe(want_overflow)
        }
        expect(summary([])).toBe(`0 / ${MAX_TEXT_ITEMS}`)
        expect(summary(items_of(1))).toBe(`1 / ${MAX_TEXT_ITEMS}`)
        expect(summary(items_of(1))).not.toContain("·")
    })

    it("flags empty text and bad hex colors as invalid", () => {
        expect(is_invalid([])).toBe(true)
        expect(is_invalid([text_item()])).toBe(false)
        expect(row_label(text_item({ text: "   " }))).toBe("(empty)")
        expect(is_invalid([text_item({ text: "   " })])).toBe(true)
        for (const color of ["#zzzzzz", "#fff"]) {
            expect(is_invalid([text_item({ color })])).toBe(true)
        }
        expect(is_invalid([text_item({ color: "#12ab34" })])).toBe(false)
    })

    it("keeps row meta anchor-only and dims below full opacity", () => {
        const item = text_item()
        expect(row_meta(item)).toBe(item.anchor)
        expect(row_meta(item)).not.toContain("·")
        expect(is_dimmed(1)).toBe(false)
        expect(is_dimmed(0.5)).toBe(true)
    })
})
