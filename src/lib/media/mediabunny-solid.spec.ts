import { describe, expect, it } from "vitest"
import { probe_media } from "./mediabunny-clip"
import type { RenderSolidOptions } from "./mediabunny-solid"
import { render_solid_color } from "./mediabunny-solid"

const base_options = (): RenderSolidOptions => ({
    color: "#ff0000",
    duration: 0.2,
    width: 64,
    height: 36,
    fps: 10,
})

describe("render_solid_color guards", () => {
    it("rejects invalid color, duration, dims, fps, quality, and crf with INVALID_RANGE", async () => {
        const bad_options: Partial<RenderSolidOptions>[] = [
            { color: "red" },
            { color: "#fff" },
            { color: "#gggggg" },
            { duration: 0 },
            { duration: 3601 },
            { width: 0 },
            { height: -36 },
            { fps: 0 },
            { quality: "extreme" as RenderSolidOptions["quality"] },
            { crf: -1 },
            { crf: 52 },
            { crf: "abc" },
        ]
        for (const override of bad_options) {
            await expect(render_solid_color({ ...base_options(), ...override })).rejects.toMatchObject({
                code: "INVALID_RANGE",
            })
        }
    })

    it("rejects a pre-aborted signal with CANCELLED before loading mediabunny", async () => {
        const controller = new AbortController()
        controller.abort()
        await expect(render_solid_color({ ...base_options(), signal: controller.signal })).rejects.toMatchObject({
            code: "CANCELLED",
        })
    })

    it("round-trips a tiny 64x36 clip to mp4 with matching probe dims", async () => {
        const blob = await render_solid_color(base_options())
        expect(blob.size).toBeGreaterThan(0)
        expect(blob.type).toBe("video/mp4")
        const probe = await probe_media(new File([blob], "solid.mp4", { type: blob.type }))
        expect(probe.display_width).toBe(64)
        expect(probe.display_height).toBe(36)
    })
})
