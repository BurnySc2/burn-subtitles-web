import { describe, expect, it, vi } from "vitest"
import { first_dropped_file, is_accepted } from "./compose-drop"

function typed_file(mime: string): File {
    return new File(["x"], "drop.bin", { type: mime })
}

describe("first_dropped_file", () => {
    it("returns files[0], null on empty or missing dataTransfer", () => {
        const accepted = typed_file("video/mp4")
        const with_file = { dataTransfer: { files: [accepted] } } as unknown as DragEvent
        expect(first_dropped_file(with_file)).toBe(accepted)
        const empty = { dataTransfer: { files: [] } } as unknown as DragEvent
        expect(first_dropped_file(empty)).toBeNull()
        const missing = { dataTransfer: null } as unknown as DragEvent
        expect(first_dropped_file(missing)).toBeNull()
    })
})

describe("is_accepted", () => {
    it.each([
        ["video/mp4", "source", true],
        ["audio/mpeg", "source", true],
        ["", "source", true],
        ["image/png", "source", false],
        ["text/plain", "source", false],
        ["image/png", "overlay", true],
        ["video/mp4", "overlay", false],
        ["audio/mpeg", "overlay", false],
        ["text/plain", "overlay", false],
        ["", "overlay", false],
    ] as const)("accepts %s for %s: %s", (mime: string, kind: "source" | "overlay", want: boolean) => {
        expect(is_accepted(typed_file(mime), kind)).toBe(want)
    })
})

describe("drop routing", () => {
    it("callers fast-fail rejected drops so probe is never called", () => {
        const probe = vi.fn()
        const handle_file = (file: File, kind: "source" | "overlay"): boolean => {
            if (!is_accepted(file, kind)) {
                return false
            }
            probe(file)
            return true
        }
        expect(handle_file(typed_file("text/plain"), "source")).toBe(false)
        expect(handle_file(typed_file("video/mp4"), "overlay")).toBe(false)
        expect(probe).not.toHaveBeenCalled()
        expect(handle_file(typed_file("video/mp4"), "source")).toBe(true)
        expect(probe).toHaveBeenCalledTimes(1)
    })
})
