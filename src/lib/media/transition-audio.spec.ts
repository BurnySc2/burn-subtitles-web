import { describe, expect, it } from "vitest"
import { ClipError } from "./mediabunny-clip"
import { premix_transition_audio } from "./transition-audio"
import { TRANSITION_AUDIO_MODES, type TransitionAudioMode, type TransitionEasing } from "./transition-utils"

function constant_buffer(value: number, seconds = 2, sample_rate = 48000): AudioBuffer {
    const buffer = new AudioBuffer({
        numberOfChannels: 2,
        length: Math.ceil(seconds * sample_rate),
        sampleRate: sample_rate,
    })
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        buffer.getChannelData(channel).fill(value)
    }
    return buffer
}

// Shared 1s inputs: A = 1, B = 0.5, so output = gain_a + 0.5 * gain_b
// exposes both legs in a single render per mode x easing.
const shared_a = constant_buffer(1, 1)
const shared_b = constant_buffer(0.5, 1)

const BLEND_START = 0.25
const BLEND_MID = 0.5
const BLEND_END = 0.75

// [mode, easing, expected at blend start/mid/end]; mid alpha is 0.5 linear, 0.25 exponential.
const blend_cases: Array<[TransitionAudioMode, TransitionEasing, number, number, number]> = [
    ["crossfade", "linear", 1, 0.75, 0.5],
    ["crossfade", "exponential", 1, 0.875, 0.5],
    ["a-flat", "linear", 1, 1, 0.5],
    ["a-flat", "exponential", 1, 1, 0.5],
    ["a-fadeout", "linear", 1, 0.5, 0.5],
    ["a-fadeout", "exponential", 1, 0.75, 0.5],
    ["b-flat", "linear", 1.5, 1, 0.5],
    ["b-flat", "exponential", 1.5, 1.25, 0.5],
    ["b-fadein", "linear", 0, 0.25, 0.5],
    ["b-fadein", "exponential", 0, 0.125, 0.5],
    ["mute", "linear", 0, 0, 0.5],
    ["mute", "exponential", 0, 0, 0.5],
    ["dip", "linear", 1, 0, 0.5],
    ["dip", "exponential", 1, 0.5, 0.5],
]

describe("premix_transition_audio", () => {
    it("returns null when both inputs are missing", async () => {
        await expect(
            premix_transition_audio({ full_a: null, full_b: null, start_a: 0, blend_duration: 1, total_duration: 1 }),
        ).resolves.toBeNull()
    })

    it("returns null for non-positive totals", async () => {
        const full_b = constant_buffer(0.5)
        await expect(
            premix_transition_audio({ full_a: null, full_b, start_a: 0, blend_duration: 1, total_duration: 0 }),
        ).resolves.toBeNull()
    })

    it("renders a 48k stereo buffer of the expected length", async () => {
        const out = await premix_transition_audio({
            full_a: constant_buffer(0.5),
            full_b: constant_buffer(0.25),
            start_a: 0,
            blend_duration: 1,
            total_duration: 1,
        })
        expect(out?.sampleRate).toBe(48000)
        expect(out?.numberOfChannels).toBe(2)
        expect(out?.length).toBe(48000)
    })

    it("fades the surviving side when one input is missing", async () => {
        const out = await premix_transition_audio({
            full_a: null,
            full_b: constant_buffer(1),
            start_a: 0,
            blend_duration: 1,
            total_duration: 1,
            easing: "linear",
        })
        const data = out?.getChannelData(0)
        expect(data?.[0]).toBeCloseTo(0, 2)
        expect(data?.[data.length - 1]).toBeCloseTo(1, 1)
    })

    it("covers the seven documented audio modes", () => {
        expect([...TRANSITION_AUDIO_MODES].sort()).toEqual(
            ["a-fadeout", "a-flat", "b-fadein", "b-flat", "crossfade", "dip", "mute"].sort(),
        )
    })

    it.each(
        blend_cases,
    )("renders %s with %s easing at blend start/mid/end", async (mode, easing, at_start, at_mid, at_end) => {
        const out = await premix_transition_audio({
            full_a: shared_a,
            full_b: shared_b,
            start_a: BLEND_START,
            blend_duration: BLEND_END - BLEND_START,
            total_duration: 1,
            easing,
            audio_mode: mode,
        })
        const data = out?.getChannelData(0)
        expect(data).toBeDefined()
        if (!data || !out) {
            return
        }
        const at_time = (time: number): number => data[Math.min(data.length - 1, Math.round(time * out.sampleRate))]
        expect(at_time(BLEND_START)).toBeCloseTo(at_start, 1)
        expect(at_time(BLEND_MID)).toBeCloseTo(at_mid, 1)
        expect(at_time(BLEND_END)).toBeCloseTo(at_end, 1)
    })

    it("rejects unknown audio modes without rendering", async () => {
        const failure = await premix_transition_audio({
            full_a: shared_a,
            full_b: shared_b,
            start_a: BLEND_START,
            blend_duration: BLEND_END - BLEND_START,
            total_duration: 1,
            audio_mode: "unknown" as TransitionAudioMode,
        }).then(
            () => null,
            (error: unknown) => error,
        )
        expect(failure).toBeInstanceOf(ClipError)
        expect((failure as ClipError).code).toBe("INVALID_RANGE")
    })
})
