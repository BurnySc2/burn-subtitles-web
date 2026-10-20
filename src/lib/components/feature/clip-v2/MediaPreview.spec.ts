import { describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import MediaPreview from "./MediaPreview.svelte"

const fake_url = "blob:fake-preview"

describe("MediaPreview", () => {
    it("renders video when has_video else audio", async () => {
        const with_video = await render(MediaPreview, {
            url: fake_url,
            has_video: true,
            on_duration: vi.fn(),
            on_error: vi.fn(),
        })
        expect(with_video.container.querySelector("video")).not.toBeNull()
        expect(with_video.container.querySelector("audio")).toBeNull()
        await with_video.unmount()
        const audio_only = await render(MediaPreview, {
            url: fake_url,
            has_video: false,
            on_duration: vi.fn(),
            on_error: vi.fn(),
        })
        expect(audio_only.container.querySelector("audio")).not.toBeNull()
        expect(audio_only.container.querySelector("video")).toBeNull()
    })

    it("calls on_duration only for finite durations", async () => {
        const on_duration = vi.fn()
        const screen = await render(MediaPreview, { url: fake_url, has_video: true, on_duration })
        const video = screen.container.querySelector("video") as HTMLVideoElement
        video.dispatchEvent(new Event("loadedmetadata"))
        expect(on_duration).not.toHaveBeenCalled()
        Object.defineProperty(video, "duration", { value: 4.25, configurable: true })
        video.dispatchEvent(new Event("loadedmetadata"))
        expect(on_duration).toHaveBeenCalledWith(4.25)
    })

    it("forwards media errors to on_error", async () => {
        const on_error = vi.fn()
        const screen = await render(MediaPreview, { url: fake_url, has_video: false, on_error })
        const audio = screen.container.querySelector("audio") as HTMLAudioElement
        audio.dispatchEvent(new Event("error"))
        expect(on_error).toHaveBeenCalledTimes(1)
    })
})
