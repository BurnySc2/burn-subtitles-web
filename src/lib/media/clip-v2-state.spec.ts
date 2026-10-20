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

    it("reset_output clears output fields and revokes the result url", () => {
        clip_v2_state.result_url = "blob:result"
        clip_v2_state.result_mime = "video/mp4"
        clip_v2_state.error = "boom"
        clip_v2_state.message = "done"
        reset_output()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:result")
        expect(clip_v2_state.result_url).toBeNull()
        expect(clip_v2_state.result_mime).toBeNull()
        expect(clip_v2_state.error).toBeNull()
        expect(clip_v2_state.message).toBeNull()
    })

    it("revoke_all resets to initial state", () => {
        clip_v2_state.source_url = "blob:source"
        clip_v2_state.result_url = "blob:result"
        clip_v2_state.duration = 42
        clip_v2_state.has_video = true
        revoke_all()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:source")
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:result")
        expect(clip_v2_state.source_file).toBeNull()
        expect(clip_v2_state.source_url).toBeNull()
        expect(clip_v2_state.duration).toBeNull()
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
