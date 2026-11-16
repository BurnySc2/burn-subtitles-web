import { describe, expect, it } from "vitest"
import { render } from "vitest-browser-svelte"
import type { ProbeResult } from "$lib/media/mediabunny-clip"
import ViewerInspector from "./ViewerInspector.svelte"

const fake_probe = (overrides: Partial<ProbeResult> = {}): ProbeResult => ({
    duration: 10,
    has_video: true,
    has_audio: false,
    kind: "video",
    file_name: "clip.mp4",
    file_size: 2048,
    container: "mp4",
    mime_type: "video/mp4",
    overall_bitrate: null,
    video_count: 1,
    audio_count: 0,
    video_codec: "avc",
    video_codec_param: null,
    display_width: 1280,
    display_height: 720,
    coded_width: 1280,
    coded_height: 720,
    frame_rate: 30,
    video_bitrate: null,
    audio_codec: null,
    audio_codec_param: null,
    audio_channels: null,
    audio_sample_rate: null,
    audio_bitrate: null,
    can_play: true,
    ...overrides,
})

// Props mirror ViewerInspector.svelte: fps, probe, measured_fps, rvfc_supported, message.
const base_props = (overrides: Record<string, unknown> = {}) => ({
    fps: 30,
    probe: fake_probe(),
    measured_fps: 29.97,
    rvfc_supported: true,
    message: null as string | null,
    ...overrides,
})

function dt_texts(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll("dt")).map((el) => el.textContent?.trim() ?? "")
}

describe("ViewerInspector", () => {
    it("shows fps rows with badges and no Time/Frame/Framecode rows", async () => {
        const screen = await render(ViewerInspector, base_props())
        const labels = dt_texts(screen.container)
        expect(labels).not.toContain("Time:")
        expect(labels).not.toContain("Frame:")
        expect(labels).not.toContain("Framecode:")
        expect(labels).toContain("Effective fps:")
        expect(labels).toContain("Measured fps:")
        expect(screen.container.textContent).toContain("30.00 fps")
        expect(screen.container.textContent).toContain("29.97 fps")
        expect(screen.container.textContent).toContain("probe")
        expect(screen.container.textContent).toContain("rVFC")
        await screen.unmount()
    })

    it("shows fallback badge and VFR warning when probe has no frame rate", async () => {
        const screen = await render(ViewerInspector, base_props({ probe: fake_probe({ frame_rate: null }) }))
        expect(screen.container.textContent).toContain("fallback")
        expect(screen.container.textContent).toContain("variable-frame-rate")
        expect(dt_texts(screen.container)).not.toContain("Frame rate:")
        await screen.unmount()
    })

    it("renders probe details and message", async () => {
        const screen = await render(ViewerInspector, base_props({ message: "Seek to 00:01 for review" }))
        expect(screen.container.querySelector("summary")?.textContent).toContain("Media details")
        expect(screen.container.textContent).toContain("clip.mp4")
        expect(screen.container.textContent).toContain("Seek to 00:01 for review")
        await screen.unmount()
    })
})
