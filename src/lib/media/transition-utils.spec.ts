import type { AudioBufferSink } from "mediabunny"
import { describe, expect, it } from "vitest"
import { TimecodeError } from "./timecode"
import { transition_filename } from "./transition-filename"
import {
    decode_full_audio,
    EASING_REGISTRY,
    estimate_frame_count,
    OUTPUT_COLOR_SPACE,
    parse_crf_override,
    phase_at,
    quality_to_video_config,
    resolve_audio_bitrate,
    resolve_duration_seconds,
    resolve_output_dims,
    resolve_output_fps,
    resolve_start_seconds,
    resolve_video_encode_config,
    TRANSITION_AUDIO_MODE_HINTS,
    TRANSITION_AUDIO_MODES,
    total_transition_duration,
    total_transition_frames,
    validate_transition_range,
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

describe("quality_to_video_config", () => {
    it("maps each quality to its bitrate ceiling", () => {
        expect(quality_to_video_config("low", 1920, 1080, 30).bitrate).toBe(2_000_000)
        expect(quality_to_video_config("medium", 1920, 1080, 30).bitrate).toBe(5_000_000)
        expect(quality_to_video_config("high", 1920, 1080, 30).bitrate).toBe(10_000_000)
        expect(quality_to_video_config("very-high", 1920, 1080, 30).bitrate).toBe(16_000_000)
        expect(quality_to_video_config("ultra", 1920, 1080, 30).bitrate).toBe(50_000_000)
    })

    it("labels ultra as high-bitrate rather than bit-exact", () => {
        expect(quality_to_video_config("ultra", 1920, 1080, 30).description).toContain("not bit-exact")
    })

    it("maps tiers to CRF quantizers with ultra bitrate-only", () => {
        expect(quality_to_video_config("low", 1920, 1080, 30).quantizer).toBe(30)
        expect(quality_to_video_config("medium", 1920, 1080, 30).quantizer).toBe(26)
        expect(quality_to_video_config("high", 1920, 1080, 30).quantizer).toBe(22)
        expect(quality_to_video_config("very-high", 1920, 1080, 30).quantizer).toBe(18)
        expect(quality_to_video_config("ultra", 1920, 1080, 30).quantizer).toBeNull()
    })

    it("prefers an explicit CRF override with tier bitrate as fallback", () => {
        const config = quality_to_video_config("ultra", 1920, 1080, 30, 22)
        expect(config.quantizer).toBe(22)
        expect(config.bitrate).toBe(50_000_000)
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

describe("parse_crf_override", () => {
    it("returns null for empty input", () => {
        expect(parse_crf_override(null)).toBeNull()
        expect(parse_crf_override(undefined)).toBeNull()
        expect(parse_crf_override("")).toBeNull()
    })

    it("accepts numbers from 0 to 51", () => {
        expect(parse_crf_override("22")).toBe(22)
        expect(parse_crf_override(0)).toBe(0)
        expect(parse_crf_override(51)).toBe(51)
    })

    it("rejects out-of-range or malformed CRF values", () => {
        for (const raw of ["-1", "52", "abc"]) {
            expect(() => parse_crf_override(raw)).toThrow(TimecodeError)
        }
        expect(() => parse_crf_override(-1)).toThrow(TimecodeError)
        expect(() => parse_crf_override(99)).toThrow(TimecodeError)
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

describe("OUTPUT_COLOR_SPACE", () => {
    it("pins bt709 VUI with BT.709 transfer and stays frozen", () => {
        expect(OUTPUT_COLOR_SPACE).toEqual({
            primaries: "bt709",
            transfer: "bt709",
            matrix: "bt709",
            fullRange: false,
        })
        expect(Object.isFrozen(OUTPUT_COLOR_SPACE)).toBe(true)
    })
})

describe("resolve_video_encode_config", () => {
    it("maps quality tier to quantizer and honors a CRF override", () => {
        const tier_default = resolve_video_encode_config("very-high", 1920, 1080, 30, null)
        expect(tier_default.quantizer).toBe(18)
        expect(tier_default.bitrate).toBe(16_000_000)
        const overridden = resolve_video_encode_config("high", 1920, 1080, 30, 18)
        expect(overridden.quantizer).toBe(18)
        expect(overridden.bitrate).toBe(10_000_000)
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
