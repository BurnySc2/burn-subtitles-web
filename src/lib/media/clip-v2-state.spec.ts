import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clip_v2_state, reset_output, revoke_all } from "./clip-v2-state.svelte"

describe("clip-v2-state", () => {
    beforeEach(() => {
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
        revoke_all()
        vi.mocked(URL.revokeObjectURL).mockClear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("reset_output clears result and revokes its url", () => {
        clip_v2_state.result = {
            url: "blob:result",
            mime: "video/mp4",
            ext: "mp4",
            size_mb: "1.00",
            duration: "00:00:01.000",
        }
        clip_v2_state.error = "boom"
        clip_v2_state.message = "done"
        reset_output()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:result")
        expect(clip_v2_state.result).toBeNull()
        expect(clip_v2_state.error).toBeNull()
        expect(clip_v2_state.message).toBeNull()
    })

    it("revoke_all resets source and result to null", () => {
        const file = new File(["x"], "a.mp4", { type: "video/mp4" })
        clip_v2_state.source = { file, url: "blob:source", probe: null }
        clip_v2_state.result = {
            url: "blob:result",
            mime: "video/mp4",
            ext: "mp4",
            size_mb: "1.00",
            duration: "00:00:01.000",
        }
        revoke_all()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:source")
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:result")
        expect(clip_v2_state.source).toBeNull()
        expect(clip_v2_state.result).toBeNull()
        expect(clip_v2_state.start_str).toBe("00:00:00.000")
        expect(clip_v2_state.end_str).toBe("")
        expect(clip_v2_state.is_processing).toBe(false)
    })

    it("is null-safe and never throws without urls", () => {
        expect(() => reset_output()).not.toThrow()
        expect(() => revoke_all()).not.toThrow()
        expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    })
})
