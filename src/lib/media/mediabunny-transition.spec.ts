import { describe, expect, it } from "vitest"
import type { ProbeResult, RenderTransitionOptions } from "./mediabunny-transition"
import { ClipError, render_transition, resolve_transition_timeline } from "./mediabunny-transition"

const test_file = (name: string) => new File([], name, { type: "video/mp4" })

const fake_probe = (overrides: Partial<ProbeResult> = {}): ProbeResult => ({
    duration: 30,
    has_video: true,
    has_audio: false,
    kind: "video",
    file_name: "a.mp4",
    file_size: 1000,
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

    it("rejects negative or non-finite start offsets with INVALID_RANGE", async () => {
        for (const start_a of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
            await expect(render_transition({ ...base_options(), start_a })).rejects.toMatchObject({
                code: "INVALID_RANGE",
            })
        }
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

    it("rejects non-positive total durations with INVALID_RANGE before loading mediabunny", async () => {
        for (const total_duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
            await expect(render_transition({ ...base_options(), total_duration })).rejects.toMatchObject({
                code: "INVALID_RANGE",
            })
        }
    })

    it("rejects total durations shorter than the transition with INVALID_RANGE", async () => {
        await expect(render_transition({ ...base_options(), duration: 2, total_duration: 1 })).rejects.toMatchObject({
            code: "INVALID_RANGE",
        })
    })

    it("rejects total durations that yield no frames with INVALID_RANGE", async () => {
        await expect(
            render_transition({ ...base_options(), duration: 0.5, fps: 30, total_duration: 0.001 }),
        ).rejects.toMatchObject({ code: "INVALID_RANGE" })
    })

    it("accepts an explicit total when source B duration is unknown", async () => {
        await expect(
            render_transition({
                ...base_options(),
                total_duration: 10,
                probe_a: fake_probe({ duration: 30 }),
                probe_b: fake_probe({ duration: null }),
            }),
        ).rejects.toMatchObject({ code: "UNSUPPORTED" })
    })

    it("exposes code and message on the thrown error", async () => {
        const error = await render_transition({ ...base_options(), duration: -2 }).catch((error: unknown) => error)
        expect(error).toBeInstanceOf(ClipError)
        expect((error as ClipError).code).toBe("INVALID_RANGE")
        expect((error as ClipError).message).toBe("Transition duration must be greater than 0 seconds.")
    })
})

describe("resolve_transition_timeline", () => {
    it("derives total from start offset plus source B duration", () => {
        expect(resolve_transition_timeline(20, 10, 40, undefined, 30)).toEqual({
            total: 60,
            total_frames: 1800,
            frame_duration: 1 / 30,
        })
    })

    it("prefers an explicit total over the derived one", () => {
        expect(resolve_transition_timeline(20, 10, 40, 100, 30).total).toBe(100)
    })

    it("rejects unknown source B duration without explicit total with INVALID_RANGE", () => {
        expect(() => resolve_transition_timeline(0, 2, null, undefined, 30)).toThrowError(ClipError)
        try {
            resolve_transition_timeline(0, 2, null, undefined, 30)
        } catch (error) {
            expect((error as ClipError).code).toBe("INVALID_RANGE")
            expect((error as ClipError).message).toBe("Source B duration is unknown — wait for probing to finish.")
        }
    })

    it("rejects non-positive or non-finite totals with INVALID_RANGE", () => {
        for (const total of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => resolve_transition_timeline(0, 2, 10, total, 30)).toThrowError(ClipError)
        }
        expect(() => resolve_transition_timeline(0, 2, -5, undefined, 30)).toThrowError(ClipError)
    })

    it("rejects totals shorter than the transition with INVALID_RANGE", () => {
        expect(() => resolve_transition_timeline(0, 2, 1, undefined, 30)).toThrowError(ClipError)
        expect(() => resolve_transition_timeline(0, 2, 30, 1, 30)).toThrowError(ClipError)
    })

    it("rejects totals that yield no frames with INVALID_RANGE", () => {
        expect(() => resolve_transition_timeline(0, 0.5, 30, 0.001, 30)).toThrowError(ClipError)
    })
})
