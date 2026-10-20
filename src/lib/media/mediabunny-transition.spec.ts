import { describe, expect, it } from "vitest"
import type { RenderTransitionOptions } from "./mediabunny-transition"
import { ClipError, render_transition } from "./mediabunny-transition"

const test_file = (name: string) => new File([], name, { type: "video/mp4" })

const base_options = (): RenderTransitionOptions => ({
    file_a: test_file("a.mp4"),
    file_b: test_file("b.mp4"),
    duration: 2,
    width: 1280,
    height: 720,
    fps: 30,
    quality: "medium",
    easing: "linear",
})

describe("render_transition guards", () => {
    it("rejects non-positive durations with INVALID_RANGE before loading mediabunny", async () => {
        for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
            await expect(render_transition({ ...base_options(), duration })).rejects.toMatchObject({
                name: "ClipError",
                code: "INVALID_RANGE",
            })
        }
    })

    it("rejects non-positive or non-integer dimensions with INVALID_RANGE", async () => {
        await expect(render_transition({ ...base_options(), width: 0 })).rejects.toMatchObject({
            code: "INVALID_RANGE",
        })
        await expect(render_transition({ ...base_options(), height: -720 })).rejects.toMatchObject({
            code: "INVALID_RANGE",
        })
        await expect(render_transition({ ...base_options(), width: 1280.5 })).rejects.toMatchObject({
            code: "INVALID_RANGE",
        })
    })

    it("rejects non-positive frame rates with INVALID_RANGE", async () => {
        await expect(render_transition({ ...base_options(), fps: 0 })).rejects.toMatchObject({
            code: "INVALID_RANGE",
        })
        await expect(render_transition({ ...base_options(), fps: Number.NaN })).rejects.toMatchObject({
            code: "INVALID_RANGE",
        })
    })

    it("rejects unknown quality or easing values with INVALID_RANGE", async () => {
        await expect(
            render_transition({ ...base_options(), quality: "extreme" as RenderTransitionOptions["quality"] }),
        ).rejects.toMatchObject({ code: "INVALID_RANGE" })
        await expect(
            render_transition({ ...base_options(), easing: "smooth" as RenderTransitionOptions["easing"] }),
        ).rejects.toMatchObject({ code: "INVALID_RANGE" })
    })

    it("rejects duration/fps combinations that yield no frames with INVALID_RANGE", async () => {
        await expect(render_transition({ ...base_options(), duration: 0.001, fps: 1 })).rejects.toMatchObject({
            code: "INVALID_RANGE",
        })
    })

    it("rejects a pre-aborted signal with CANCELLED before loading mediabunny", async () => {
        const controller = new AbortController()
        controller.abort()
        await expect(render_transition({ ...base_options(), signal: controller.signal })).rejects.toMatchObject({
            code: "CANCELLED",
        })
    })

    it("exposes code and message on the thrown error", async () => {
        const error = await render_transition({ ...base_options(), duration: -2 }).catch((error: unknown) => error)
        expect(error).toBeInstanceOf(ClipError)
        expect((error as ClipError).code).toBe("INVALID_RANGE")
        expect((error as ClipError).message).toBe("Transition duration must be greater than 0 seconds.")
    })
})
