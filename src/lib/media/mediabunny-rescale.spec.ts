import { describe, expect, it } from "vitest"
import { probe_media } from "./mediabunny-clip"
import { render_rescale, type RenderRescaleOptions } from "./mediabunny-rescale"
import { render_solid_color } from "./mediabunny-solid"

const valid_blob = (): Blob => new Blob(["x"], { type: "video/mp4" })

const base_options = (): RenderRescaleOptions => ({ width: 32, height: 18, fps: null, fit: "contain" })

describe("render_rescale guards", () => {
    it("rejects bad dims/fps/fit/empty input with INVALID_RANGE, CANCELLED when pre-aborted, and accepts fps null", async () => {
        const bad: Partial<RenderRescaleOptions>[] = [
            { width: 31 },
            { height: 17 },
            { width: 7682 },
            { height: 7682 },
            { width: 0 },
            { fps: 0 },
            { fps: -5 },
            { fps: Number.NaN },
            { fit: "cover" as RenderRescaleOptions["fit"] },
        ]
        for (const override of bad) {
            await expect(render_rescale(valid_blob(), { ...base_options(), ...override })).rejects.toMatchObject({
                name: "ClipError",
                code: "INVALID_RANGE",
            })
        }
        await expect(render_rescale(new Blob([], { type: "video/mp4" }), base_options())).rejects.toMatchObject({
            code: "INVALID_RANGE",
        })
        const controller = new AbortController()
        controller.abort()
        // fps null passes validation, so a valid blob with a pre-aborted signal reaches CANCELLED.
        await expect(
            render_rescale(valid_blob(), { ...base_options(), signal: controller.signal }),
        ).rejects.toMatchObject({ code: "CANCELLED" })
        await expect(
            render_rescale(valid_blob(), { ...base_options(), fps: 10, signal: controller.signal }),
        ).rejects.toMatchObject({ code: "CANCELLED" })
    })

    it(
        "rescales a 64x36 solid source to 32x18 with fps null, preserving dims and duration",
        { timeout: 60_000 },
        async () => {
            const source = await render_solid_color({
                color: "#123456",
                duration: 1,
                width: 64,
                height: 36,
                fps: 10,
                quality: "low",
            })
            const output = await render_rescale(source, {
                width: 32,
                height: 18,
                fps: null,
                fit: "contain",
                quality: "low",
            })
            expect(output.size).toBeGreaterThan(0)
            const probe = await probe_media(new File([output], "rescaled.mp4", { type: output.type }))
            expect(probe.display_width).toBe(32)
            expect(probe.display_height).toBe(18)
            expect(probe.duration).not.toBeNull()
            expect(Math.abs((probe.duration ?? 0) - 1)).toBeLessThan(0.25)
        },
    )

    it("passes silence through: a silent solid source rescales to audio-free output", { timeout: 60_000 }, async () => {
        const source = await render_solid_color({
            color: "#654321",
            duration: 0.5,
            width: 64,
            height: 36,
            fps: 10,
            quality: "low",
        })
        const output = await render_rescale(source, {
            width: 32,
            height: 18,
            fps: null,
            fit: "contain",
            quality: "low",
        })
        const probe = await probe_media(new File([output], "rescaled.mp4", { type: output.type }))
        expect(probe.has_audio).toBe(false)
        expect(probe.audio_count).toBe(0)
    })
})
