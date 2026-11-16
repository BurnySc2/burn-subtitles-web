import { describe, expect, it } from "vitest"
import type { OverlayPosition } from "./compose-types"
import { resolve_overlay_rect } from "./mediabunny-overlay"

const bg_width = 1280
const bg_height = 720
const img_width = 640
const img_height = 360
const scale = 10

const rect = (position: OverlayPosition, offset_x: number, offset_y: number) =>
    resolve_overlay_rect({
        bg_width,
        bg_height,
        img_width,
        img_height,
        position,
        scale,
        offset_x,
        offset_y,
    })

describe("resolve_overlay_rect", () => {
    it("maps all nine anchors with zero offsets", () => {
        const cases: Array<[OverlayPosition, number, number]> = [
            ["top-left", 0, 0],
            ["top-center", 576, 0],
            ["top-right", 1152, 0],
            ["center-left", 0, 324],
            ["center", 576, 324],
            ["center-right", 1152, 324],
            ["bottom-left", 0, 648],
            ["bottom-center", 576, 648],
            ["bottom-right", 1152, 648],
        ]
        for (const [position, dx, dy] of cases) {
            const result = rect(position, 0, 0)
            expect({ dx: result.dx, dy: result.dy }).toEqual({ dx, dy })
            expect(result.dw).toBe(128)
            expect(result.dh).toBe(72)
        }
    })

    it("applies signed offsets in uniform canvas space", () => {
        expect(rect("top-left", 10, 20)).toMatchObject({ dx: 10, dy: 20 })
        expect(rect("top-left", -10, -20)).toMatchObject({ dx: -10, dy: -20 })
        expect(rect("bottom-right", 10, 20)).toMatchObject({ dx: 1162, dy: 668 })
        expect(rect("center", 15, -25)).toMatchObject({ dx: 591, dy: 299 })
        expect(rect("top-center", -30, 40)).toMatchObject({ dx: 546, dy: 40 })
        expect(rect("center-left", 12, -8)).toMatchObject({ dx: 12, dy: 316 })
    })

    it("leaves results unclamped in canvas space", () => {
        expect(rect("top-left", 5000, 5000)).toMatchObject({ dx: 5000, dy: 5000 })
        expect(rect("bottom-right", 5000, 5000)).toMatchObject({ dx: 6152, dy: 5648 })
        expect(rect("center", -5000, 5000)).toMatchObject({ dx: -4424, dy: 5324 })
    })
})
