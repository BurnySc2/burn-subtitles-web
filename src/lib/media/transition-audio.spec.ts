import { describe, expect, it } from "vitest"
import { premix_transition_audio } from "./transition-audio"

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
})
