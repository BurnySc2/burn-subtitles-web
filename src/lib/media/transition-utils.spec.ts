import type { AudioBufferSink } from "mediabunny"
import { describe, expect, it, vi } from "vitest"
import { TimecodeError } from "./timecode"
import { transition_filename } from "./transition-filename"
import {
    add_canvas_frame,
    type CanvasEncodeSetup,
    clamp_video_bitrate_kbps,
    create_video_sample_source,
    decode_full_audio,
    EASING_REGISTRY,
    estimate_frame_count,
    estimate_output_bytes,
    format_size_estimate,
    phase_at,
    resolve_audio_bitrate,
    resolve_compose_video_bps,
    resolve_duration_seconds,
    resolve_output_dims,
    resolve_output_fps,
    resolve_output_video_config,
    resolve_start_seconds,
    TRANSITION_AUDIO_MODE_HINTS,
    TRANSITION_AUDIO_MODES,
    total_transition_duration,
    total_transition_frames,
    validate_transition_range,
    with_canvas_encode,
} from "./transition-utils"

describe("EASING_REGISTRY", () => {
    it("maps linear to identity and exponential to quadratic", () => {
        expect(EASING_REGISTRY.linear(0)).toBe(0)
        expect(EASING_REGISTRY.linear(0.5)).toBe(0.5)
        expect(EASING_REGISTRY.linear(1)).toBe(1)
        expect(EASING_REGISTRY.exponential(0)).toBe(0)
        expect(EASING_REGISTRY.exponential(0.5)).toBe(0.25)
        expect(EASING_REGISTRY.exponential(1)).toBe(1)
    })
})

describe("resolve_output_dims", () => {
    const probe_a = { display_width: 1920, display_height: 1080 }
    const probe_b = { display_width: 1280, display_height: 720 }

    it("selects dims from the chosen resolution source", () => {
        expect(resolve_output_dims(probe_a, probe_b, "a")).toEqual({ width: 1920, height: 1080 })
        expect(resolve_output_dims(probe_a, probe_b, "b")).toEqual({ width: 1280, height: 720 })
    })

    it("falls back to the other probe and returns null when neither has dims", () => {
        expect(resolve_output_dims(null, probe_b, "a")).toEqual({ width: 1280, height: 720 })
        expect(resolve_output_dims(probe_a, null, "b")).toEqual({ width: 1920, height: 1080 })
        expect(resolve_output_dims(null, null, "a")).toBeNull()
        expect(resolve_output_dims({ display_width: 1920, display_height: null }, null, "a")).toBeNull()
    })
})

describe("resolve_output_fps", () => {
    it("returns fixed modes numerically", () => {
        expect(resolve_output_fps(null, null, "24")).toBe(24)
        expect(resolve_output_fps(null, null, "30")).toBe(30)
        expect(resolve_output_fps(null, null, "60")).toBe(60)
    })

    it("reads the chosen probe and falls back to 30 when missing", () => {
        expect(resolve_output_fps({ frame_rate: 25 }, { frame_rate: 50 }, "a")).toBe(25)
        expect(resolve_output_fps({ frame_rate: 25 }, { frame_rate: 50 }, "b")).toBe(50)
        expect(resolve_output_fps(null, null, "a")).toBe(30)
        expect(resolve_output_fps({ frame_rate: null }, null, "a")).toBe(30)
        expect(resolve_output_fps({ frame_rate: 0 }, null, "b")).toBe(30)
    })
})

describe("resolve_duration_seconds", () => {
    it("accepts a positive duration within the shortest source", () => {
        expect(resolve_duration_seconds("1.0", 10, 8)).toBe(1)
        expect(resolve_duration_seconds("8", 10, 8)).toBe(8)
        expect(resolve_duration_seconds("2.5", null, null)).toBe(2.5)
    })

    it("rejects non-positive, malformed, or overlong durations", () => {
        for (const raw of ["0", "-1", "abc", "", "  "]) {
            expect(() => resolve_duration_seconds(raw, 10, 8)).toThrow(TimecodeError)
        }
        expect(() => resolve_duration_seconds("9", 10, 8)).toThrow(TimecodeError)
        expect(() => resolve_duration_seconds("11", 10, null)).toThrow(TimecodeError)
    })
})

describe("resolve_start_seconds", () => {
    it("accepts a start offset fitting inside source A", () => {
        expect(resolve_start_seconds("0", 10, 1)).toBe(0)
        expect(resolve_start_seconds(" 2.5 ", 10, 1)).toBe(2.5)
        expect(resolve_start_seconds("9", 10, 1)).toBe(9)
    })

    it("rejects negative, malformed, unknown-length, or overflowing starts", () => {
        for (const raw of ["-1", "abc", "", "  "]) {
            expect(() => resolve_start_seconds(raw, 10, 1)).toThrow(TimecodeError)
        }
        expect(() => resolve_start_seconds("1", null, 1)).toThrow(TimecodeError)
        expect(() => resolve_start_seconds("9.5", 10, 1)).toThrow(TimecodeError)
    })
})

describe("validate_transition_range", () => {
    it("passes when start plus duration fits A and duration fits B", () => {
        expect(() => validate_transition_range(2, 1, 10, 8)).not.toThrow()
        expect(() => validate_transition_range(0, 2.5, null, null)).not.toThrow()
    })

    it("rejects overflow beyond either source", () => {
        expect(() => validate_transition_range(9.5, 1, 10, 8)).toThrow(TimecodeError)
        expect(() => validate_transition_range(0, 9, 10, 8)).toThrow(TimecodeError)
        expect(() => validate_transition_range(-1, 1, 10, 8)).toThrow(TimecodeError)
        expect(() => validate_transition_range(0, 0, 10, 8)).toThrow(TimecodeError)
    })
})

describe("clamp_video_bitrate_kbps", () => {
    it.each([
        [499, null],
        [500, 500],
        [8000, 8000],
        [100000, 100000],
        [100001, null],
    ] as const)("maps %i to %s", (raw, want) => {
        expect(clamp_video_bitrate_kbps(raw)).toBe(want)
    })

    it("rejects nullish and non-finite input", () => {
        expect(clamp_video_bitrate_kbps(null)).toBeNull()
        expect(clamp_video_bitrate_kbps(undefined)).toBeNull()
        expect(clamp_video_bitrate_kbps(Number.NaN)).toBeNull()
    })
})

describe("resolve_compose_video_bps", () => {
    it("converts kbps to bps and nulls invalid input", () => {
        expect(resolve_compose_video_bps(8000)).toBe(8_000_000)
        expect(resolve_compose_video_bps(null)).toBeNull()
        expect(resolve_compose_video_bps(499)).toBeNull()
        expect(resolve_compose_video_bps(100001)).toBeNull()
    })
})

describe("resolve_output_video_config", () => {
    it("resolves 8000 kbps to an 8M config", () => {
        const config = resolve_output_video_config({ video_bitrate_kbps: 8000, width: 1280, height: 720, fps: 30 })
        expect(config.bitrate).toBe(8_000_000)
        expect(config.description).toContain("8Mbps")
    })
})

describe("estimate_output_bytes", () => {
    it("computes bytes from duration and combined bitrates", () => {
        expect(estimate_output_bytes(60, 2_000_000, 128_000)).toBe(15_960_000)
    })

    it("returns null without full inputs", () => {
        expect(estimate_output_bytes(null, 2_000_000, 128_000)).toBeNull()
        expect(estimate_output_bytes(60, null, 128_000)).toBeNull()
        expect(estimate_output_bytes(60, 2_000_000, null)).toBeNull()
    })
})

describe("format_size_estimate", () => {
    it("renders an em dash without full inputs", () => {
        expect(format_size_estimate(null, 2_000_000, 128_000)).toBe("—")
        expect(format_size_estimate(60, null, 128_000)).toBe("—")
    })

    it("formats the 60s 2M plus 128k example", () => {
        expect(format_size_estimate(60, 2_000_000, 128_000)).toBe(
            "Est ≈ 16.0 MB · video 2 Mbps + audio 128 kbps · VBR varies",
        )
    })
})

describe("resolve_audio_bitrate", () => {
    it("returns numeric presets directly", () => {
        expect(resolve_audio_bitrate(null, null, "96k")).toBe(96_000)
        expect(resolve_audio_bitrate(null, null, "320k")).toBe(320_000)
    })

    it("resolves source-max from the louder probe and clamps to 96k..320k", () => {
        const loud = { audio_bitrate: 500_000, overall_bitrate: null }
        expect(resolve_audio_bitrate(loud, null, "source-max")).toBe(320_000)
        const quiet = { audio_bitrate: 10_000, overall_bitrate: null }
        expect(resolve_audio_bitrate(quiet, null, "source-max")).toBe(96_000)
        expect(
            resolve_audio_bitrate(
                { audio_bitrate: 192_000, overall_bitrate: null },
                { audio_bitrate: 128_000, overall_bitrate: null },
                "source-max",
            ),
        ).toBe(192_000)
    })

    it("falls back to overall bitrate and then 128k when unknown", () => {
        expect(
            resolve_audio_bitrate(
                { audio_bitrate: null, overall_bitrate: 200_000 },
                { audio_bitrate: null, overall_bitrate: null },
                "source-max",
            ),
        ).toBe(200_000)
        expect(resolve_audio_bitrate(null, null, "source-max")).toBe(128_000)
    })
})

describe("estimate_frame_count", () => {
    it("rounds duration times fps", () => {
        expect(estimate_frame_count(1, 30)).toBe(30)
        expect(estimate_frame_count(2.5, 60)).toBe(150)
        expect(estimate_frame_count(0.001, 1)).toBe(0)
    })
})

describe("transition_filename", () => {
    it("joins both basenames with duration and strips extensions", () => {
        expect(transition_filename("intro.mp4", "outro.mkv", 1.5, "mp4")).toBe("intro_x_outro_1.5s.mp4")
        expect(transition_filename("intro.mp4", "outro.mkv", 1, ".mp4")).toBe("intro_x_outro_1s.mp4")
    })

    it("sanitizes illegal chars from both names", () => {
        expect(transition_filename("my: video.mp4", "clip?2.mkv", 2, "mp4")).toBe("my- video_x_clip2_2s.mp4")
    })
})

describe("phase_at", () => {
    it("returns solo-a before the blend start and solo-b at or past total", () => {
        expect(phase_at(-1, 20, 10, 60)).toEqual({ phase: "solo-a", alpha: 0 })
        expect(phase_at(0, 20, 10, 60)).toEqual({ phase: "solo-a", alpha: 0 })
        expect(phase_at(19.999, 20, 10, 60)).toEqual({ phase: "solo-a", alpha: 0 })
        expect(phase_at(60, 20, 10, 60)).toEqual({ phase: "solo-b", alpha: 1 })
        expect(phase_at(100, 20, 10, 60)).toEqual({ phase: "solo-b", alpha: 1 })
    })

    it("blends from alpha 0 to 1 across the overlap with easing", () => {
        expect(phase_at(20, 20, 10, 60)).toEqual({ phase: "blend", alpha: 0 })
        expect(phase_at(25, 20, 10, 60)).toEqual({ phase: "blend", alpha: 0.5 })
        expect(phase_at(25, 20, 10, 60, "exponential")).toEqual({ phase: "blend", alpha: 0.25 })
        expect(phase_at(30, 20, 10, 60)).toEqual({ phase: "solo-b", alpha: 1 })
        expect(phase_at(45, 20, 10, 60)).toEqual({ phase: "solo-b", alpha: 1 })
    })
})

describe("total_transition_duration", () => {
    it("sums start offset and source B length", () => {
        expect(total_transition_duration(20, 40)).toBe(60)
    })

    it("returns null while source B length is unknown", () => {
        expect(total_transition_duration(20, null)).toBeNull()
    })
})

describe("total_transition_frames", () => {
    it("rounds total duration times fps", () => {
        expect(total_transition_frames(60, 30)).toBe(1800)
        expect(total_transition_frames(0.001, 1)).toBe(0)
    })
})

describe("TRANSITION_AUDIO_MODE_HINTS", () => {
    it("covers exactly the nine documented audio modes", () => {
        expect(Object.keys(TRANSITION_AUDIO_MODE_HINTS).sort()).toEqual([...TRANSITION_AUDIO_MODES].sort())
        expect(TRANSITION_AUDIO_MODES).toHaveLength(9)
    })

    it.each(["a-only", "b-only"] as const)("ends %s hint with the silence suffix", (mode) => {
        expect(TRANSITION_AUDIO_MODE_HINTS[mode].endsWith("Renders silence if that side has no audio.")).toBe(true)
    })
})

describe("decode_full_audio", () => {
    it("returns null when the sink yields no buffers", async () => {
        const empty_sink = {
            buffers: async function* () {
                // Yields nothing: empty audio sink.
            },
        }
        await expect(decode_full_audio(empty_sink as unknown as AudioBufferSink)).resolves.toBeNull()
    })
})

describe("with_canvas_encode", () => {
    it("rejects with CANCELLED without calling body when already aborted", async () => {
        const controller = new AbortController()
        controller.abort()
        let called = false
        await expect(
            with_canvas_encode({
                width: 64,
                height: 64,
                fps: 30,
                quality: "low",
                audio_probe: null,
                audio_quality: "source-max",
                needs_audio: false,
                probe_has_audio: false,
                head_blob_for_audio: null,
                signal: controller.signal,
                body: async () => {
                    called = true
                    return 1
                },
            }),
        ).rejects.toMatchObject({ name: "ClipError", code: "CANCELLED" })
        expect(called).toBe(false)
    })

    it("builds a canvas setup and finalizes a single frame without audio", async () => {
        const holder: { setup: CanvasEncodeSetup | null } = { setup: null }
        const result = await with_canvas_encode({
            width: 64,
            height: 64,
            fps: 30,
            quality: "low",
            audio_probe: null,
            audio_quality: "source-max",
            needs_audio: false,
            probe_has_audio: false,
            head_blob_for_audio: null,
            body: async (setup, mb) => {
                holder.setup = setup
                setup.ctx.fillStyle = "#123456"
                setup.ctx.fillRect(0, 0, 64, 64)
                await add_canvas_frame(mb, setup.video_source, setup.canvas, 0, 1 / 30)
                return "done"
            },
        })
        expect(result).toBe("done")
        expect(holder.setup?.canvas.width).toBe(64)
        expect(holder.setup?.canvas.height).toBe(64)
        expect(holder.setup?.audio_source).toBeNull()
        expect(holder.setup?.decoded).toBeNull()
        expect(holder.setup?.target.buffer?.byteLength ?? 0).toBeGreaterThan(0)
    })

    it("skips the audio track when requested but no head blob is available", async () => {
        const holder: { setup: CanvasEncodeSetup | null } = { setup: null }
        await with_canvas_encode({
            width: 64,
            height: 64,
            fps: 30,
            quality: "low",
            audio_probe: { audio_bitrate: 128_000, overall_bitrate: null },
            audio_quality: "source-max",
            needs_audio: true,
            probe_has_audio: true,
            head_blob_for_audio: null,
            body: async (setup, mb) => {
                holder.setup = setup
                setup.ctx.fillStyle = "#000"
                setup.ctx.fillRect(0, 0, 64, 64)
                await add_canvas_frame(mb, setup.video_source, setup.canvas, 0, 1 / 30)
            },
        })
        expect(holder.setup?.audio_source).toBeNull()
        expect(holder.setup?.decoded).toBeNull()
    })

    it("skips the audio track when the probe reports no audio despite a head blob", async () => {
        const holder: { setup: CanvasEncodeSetup | null } = { setup: null }
        const head_blob = new File(["head-bytes"], "head.mp4", { type: "video/mp4" })
        await with_canvas_encode({
            width: 64,
            height: 64,
            fps: 30,
            quality: "low",
            audio_probe: { audio_bitrate: 128_000, overall_bitrate: null },
            audio_quality: "192k",
            needs_audio: true,
            probe_has_audio: false,
            head_blob_for_audio: head_blob,
            body: async (setup, mb) => {
                holder.setup = setup
                setup.ctx.fillStyle = "#000"
                setup.ctx.fillRect(0, 0, 64, 64)
                await add_canvas_frame(mb, setup.video_source, setup.canvas, 0, 1 / 30)
            },
        })
        expect(holder.setup?.audio_source).toBeNull()
        expect(holder.setup?.decoded).toBeNull()
    })

    it("uses a provided audio buffer when supplied", async () => {
        const holder: { setup: CanvasEncodeSetup | null } = { setup: null }
        let calls = 0
        const buffer = new AudioBuffer({ numberOfChannels: 1, length: 8000, sampleRate: 8000 })
        await with_canvas_encode({
            width: 64,
            height: 64,
            fps: 30,
            quality: "low",
            audio_probe: null,
            audio_quality: "128k",
            needs_audio: false,
            probe_has_audio: false,
            head_blob_for_audio: null,
            audio: {
                kind: "provided",
                get_audio: async () => {
                    calls += 1
                    return { buffer, bitrate: 128_000 }
                },
            },
            body: async (setup, mb) => {
                holder.setup = setup
                setup.ctx.fillStyle = "#000"
                setup.ctx.fillRect(0, 0, 64, 64)
                await add_canvas_frame(mb, setup.video_source, setup.canvas, 0, 1 / 30)
            },
        })
        expect(calls).toBe(1)
        expect(holder.setup?.decoded).toBe(buffer)
        expect(holder.setup?.audio_source).not.toBeNull()
        expect(holder.setup?.target.buffer?.byteLength ?? 0).toBeGreaterThan(0)
    })

    it("skips the audio track when the provider returns null", async () => {
        const holder: { setup: CanvasEncodeSetup | null } = { setup: null }
        let calls = 0
        await with_canvas_encode({
            width: 64,
            height: 64,
            fps: 30,
            quality: "low",
            audio_probe: null,
            audio_quality: "source-max",
            needs_audio: false,
            probe_has_audio: false,
            head_blob_for_audio: null,
            audio: {
                kind: "provided",
                get_audio: async () => {
                    calls += 1
                    return { buffer: null, bitrate: null }
                },
            },
            body: async (setup, mb) => {
                holder.setup = setup
                setup.ctx.fillStyle = "#000"
                setup.ctx.fillRect(0, 0, 64, 64)
                await add_canvas_frame(mb, setup.video_source, setup.canvas, 0, 1 / 30)
            },
        })
        expect(calls).toBe(1)
        expect(holder.setup?.audio_source).toBeNull()
        expect(holder.setup?.decoded).toBeNull()
    })

    it("maps abort during body to CANCELLED via finalize", async () => {
        const controller = new AbortController()
        await expect(
            with_canvas_encode({
                width: 64,
                height: 64,
                fps: 30,
                quality: "low",
                audio_probe: null,
                audio_quality: "source-max",
                needs_audio: false,
                probe_has_audio: false,
                head_blob_for_audio: null,
                signal: controller.signal,
                body: async (setup, mb) => {
                    setup.ctx.fillStyle = "#000"
                    setup.ctx.fillRect(0, 0, 64, 64)
                    await add_canvas_frame(mb, setup.video_source, setup.canvas, 0, 1 / 30)
                    controller.abort()
                },
            }),
        ).rejects.toMatchObject({ name: "ClipError", code: "CANCELLED" })
    })
})

describe("post-revert encoder defaults", () => {
    it("passes timestamp/duration only to VideoFrame and VideoSample", async () => {
        const canvas = document.createElement("canvas")
        canvas.width = 2
        canvas.height = 2
        const frame_inits: Array<Record<string, unknown>> = []
        const sample_inits: Array<Record<string, unknown>> = []
        const holder = globalThis as unknown as Record<string, unknown>
        const original_frame = holder.VideoFrame
        holder.VideoFrame = class {
            constructor(_source: unknown, init: Record<string, unknown>) {
                frame_inits.push({ ...init })
            }
            close(): void {}
        }
        const added: unknown[] = []
        const fake_source = {
            add: async (sample: unknown): Promise<void> => {
                added.push(sample)
            },
        }
        const stub_mb = {
            VideoSample: class {
                constructor(_frame: unknown, options: Record<string, unknown>) {
                    sample_inits.push({ ...options })
                }
                close(): void {}
            },
        }
        try {
            await add_canvas_frame(
                stub_mb as unknown as typeof import("mediabunny"),
                fake_source as unknown as InstanceType<typeof import("mediabunny").VideoSampleSource>,
                canvas,
                1.5,
                0.5,
            )
        } finally {
            holder.VideoFrame = original_frame
        }
        expect(frame_inits).toHaveLength(1)
        expect(frame_inits[0]).toEqual({ timestamp: 1_500_000, duration: 500_000 })
        expect(sample_inits).toHaveLength(1)
        expect(sample_inits[0]).toEqual({ timestamp: 1.5, duration: 0.5 })
    })

    it("passes onEncoderConfig to VideoSampleSource and logs the encode report", () => {
        let captured: Record<string, unknown> | null = null
        const stub_mb = {
            Quality: class {
                options: unknown
                constructor(options: unknown) {
                    this.options = options
                }
            },
            VideoSampleSource: class {
                constructor(options: Record<string, unknown>) {
                    captured = { ...options }
                }
            },
        }
        const reported: unknown[] = []
        create_video_sample_source(
            stub_mb as unknown as typeof import("mediabunny"),
            {
                bitrate: 5_000_000,
                description: "medium",
            },
            { on_encode_report: (r: unknown) => reported.push(r) },
        )
        expect(captured).not.toBeNull()
        expect(Object.keys(captured ?? {}).sort()).toEqual(
            ["bitrateMode", "codec", "hardwareAcceleration", "latencyMode", "onEncoderConfig", "quality"].sort(),
        )
        expect(captured ?? {}).not.toHaveProperty("onEncodedPacket")
        expect(typeof (captured as unknown as Record<string, unknown>).onEncoderConfig).toBe("function")
        const log_spy = vi.spyOn(console, "log").mockImplementation(() => {})
        try {
            const on_config = (captured as unknown as { onEncoderConfig: (enc: VideoEncoderConfig) => void })
                .onEncoderConfig
            on_config({ codec: "avc", width: 1920, height: 1080 } as VideoEncoderConfig)
            expect(log_spy).toHaveBeenCalledWith("[encode]", expect.anything())
            expect(reported).toHaveLength(1)
        } finally {
            log_spy.mockRestore()
        }
    })

    it("exposes no OUTPUT_COLOR_SPACE export", async () => {
        const module = await import("./transition-utils")
        expect(module as Record<string, unknown>).not.toHaveProperty("OUTPUT_COLOR_SPACE")
    })
})
