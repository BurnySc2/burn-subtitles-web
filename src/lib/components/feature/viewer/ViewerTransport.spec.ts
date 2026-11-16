import { describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import { format_viewer_summary } from "$lib/media/framecode"
import ViewerTransport from "./ViewerTransport.svelte"

function readout_text(screen: { container: HTMLElement }): string {
    return screen.container.querySelector('[role="status"]')?.textContent?.trim() ?? ""
}

function make_media(initial_time: number): HTMLVideoElement {
    const el = document.createElement("video")
    let time = initial_time
    Object.defineProperty(el, "currentTime", {
        get: () => time,
        set: (value: number) => {
            time = value
        },
        configurable: true,
    })
    el.pause = vi.fn() as unknown as () => void
    return el
}

describe("ViewerTransport", () => {
    it("renders dash when time unknown and frame readout when known", async () => {
        const on_fullscreen = vi.fn()
        const unknown = await render(ViewerTransport, {
            video_el: null,
            fps: 30,
            duration: null,
            current_time: null,
            disabled: true,
            on_fullscreen,
        })
        expect(readout_text(unknown)).toBe("—")
        await unknown.unmount()

        const known = await render(ViewerTransport, {
            video_el: null,
            fps: 30,
            duration: 10,
            current_time: 1.5,
            disabled: true,
            on_fullscreen,
        })
        expect(readout_text(known)).toBe("1.50 s (frame 45) of 10.0 s")
        await known.unmount()
    })

    it("steps frames with step buttons and exposes seek slider", async () => {
        const video = make_media(1.5)
        const screen = await render(ViewerTransport, {
            video_el: video,
            fps: 30,
            duration: 10,
            current_time: 1.5,
            disabled: false,
            on_fullscreen: vi.fn(),
        })
        expect(screen.container.querySelector('input[aria-label="Seek"]')).not.toBeNull()
        const step_forward = screen.container.querySelector(
            'button[aria-label="Step forward 1 frame"]',
        ) as HTMLButtonElement
        step_forward.click()
        await vi.waitFor(() => expect(video.currentTime).toBeCloseTo(46 / 30, 5))
        const step_back = screen.container.querySelector('button[aria-label="Step back 1 frame"]') as HTMLButtonElement
        step_back.click()
        await vi.waitFor(() => expect(video.currentTime).toBeCloseTo(1.5, 5))
        await screen.unmount()
    })

    it("exposes volume, mute and fullscreen controls and calls on_fullscreen", async () => {
        const video = make_media(1.5)
        const on_fullscreen = vi.fn()
        const screen = await render(ViewerTransport, {
            video_el: video,
            fps: 30,
            duration: 10,
            current_time: 1.5,
            disabled: false,
            on_fullscreen,
        })
        expect(screen.container.querySelector('input[aria-label="Volume"]')).not.toBeNull()
        expect(screen.container.querySelector('button[aria-label="Mute"], button[aria-label="Unmute"]')).not.toBeNull()
        const fullscreen = screen.container.querySelector('button[aria-label="Fullscreen"]') as HTMLButtonElement
        fullscreen.click()
        expect(on_fullscreen).toHaveBeenCalledTimes(1)
        await screen.unmount()
    })

    it("disables copy buttons when time is unknown", async () => {
        const screen = await render(ViewerTransport, {
            video_el: null,
            fps: 30,
            duration: null,
            current_time: null,
            disabled: true,
            on_fullscreen: vi.fn(),
        })
        for (const label of ["Copy seconds", "Copy frames", "Copy both"]) {
            const button = Array.from(screen.container.querySelectorAll("button")).find((el) =>
                el.textContent?.includes(label),
            ) as HTMLButtonElement
            expect(button.disabled).toBe(true)
        }
        await screen.unmount()
    })

    it("copies seconds, frames and summary to clipboard", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal("navigator", { clipboard: { writeText } })
        const screen = await render(ViewerTransport, {
            video_el: make_media(1.5),
            fps: 30,
            duration: 10,
            current_time: 1.5,
            disabled: false,
            on_fullscreen: vi.fn(),
        })
        const button_for = (label: string) =>
            Array.from(screen.container.querySelectorAll("button")).find((el) =>
                el.textContent?.includes(label),
            ) as HTMLButtonElement
        const feedback = () => {
            const spans = screen.container.querySelectorAll('span[role="status"]')
            return spans[spans.length - 1]?.textContent?.trim() ?? ""
        }
        button_for("Copy seconds").click()
        await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("1.500"))
        await vi.waitFor(() => expect(feedback()).toBe("Copied seconds"))
        button_for("Copy frames").click()
        await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("45"))
        await vi.waitFor(() => expect(feedback()).toBe("Copied frames"))
        button_for("Copy both").click()
        await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(format_viewer_summary(1.5, 30, 10)))
        await vi.waitFor(() => expect(feedback()).toBe("Copied both"))
        await screen.unmount()
        vi.unstubAllGlobals()
    })

    it("shows Copy failed when clipboard rejects", async () => {
        const writeText = vi.fn().mockRejectedValue(new Error("denied"))
        vi.stubGlobal("navigator", { clipboard: { writeText } })
        const screen = await render(ViewerTransport, {
            video_el: make_media(1.5),
            fps: 30,
            duration: 10,
            current_time: 1.5,
            disabled: false,
            on_fullscreen: vi.fn(),
        })
        const button = Array.from(screen.container.querySelectorAll("button")).find((el) =>
            el.textContent?.includes("Copy seconds"),
        ) as HTMLButtonElement
        button.click()
        await vi.waitFor(() => {
            const spans = screen.container.querySelectorAll('span[role="status"]')
            const text = spans[spans.length - 1]?.textContent?.trim() ?? ""
            expect(text).toBe("Copy failed")
        })
        await screen.unmount()
        vi.unstubAllGlobals()
    })
})
