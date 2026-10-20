import { describe, expect, it } from "vitest"
import { ClipError, extract_clip } from "./mediabunny-clip"

const test_file = () => new File([], "t.mp4", { type: "video/mp4" })

describe("extract_clip guards", () => {
    it("rejects end <= start with INVALID_RANGE before loading mediabunny", async () => {
        await expect(extract_clip({ file: test_file(), start: 5, end: 5, output_kind: "mp4" })).rejects.toMatchObject({
            name: "ClipError",
            code: "INVALID_RANGE",
        })
        await expect(extract_clip({ file: test_file(), start: 8, end: 2, output_kind: "wav" })).rejects.toMatchObject({
            code: "INVALID_RANGE",
        })
    })

    it("rejects a pre-aborted signal with CANCELLED before loading mediabunny", async () => {
        const controller = new AbortController()
        controller.abort()
        await expect(
            extract_clip({ file: test_file(), start: 0, end: 1, output_kind: "mp4", signal: controller.signal }),
        ).rejects.toMatchObject({ code: "CANCELLED" })
    })

    it("exposes code and message on the thrown error", async () => {
        const error = await extract_clip({
            file: test_file(),
            start: 3,
            end: 1,
            output_kind: "mp3",
        }).catch((error: unknown) => error)
        expect(error).toBeInstanceOf(ClipError)
        expect((error as ClipError).code).toBe("INVALID_RANGE")
        expect((error as ClipError).message).toBe("End time must be greater than start time")
    })
})
