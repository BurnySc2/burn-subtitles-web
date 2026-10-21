import { describe, expect, it } from "vitest"
import { concat_audio_buffers, premix_compose_audio } from "./compose-audio"

function constant_buffer(value: number, seconds = 1, sample_rate = 48000, channels = 2): AudioBuffer {
    const buffer = new AudioBuffer({
        numberOfChannels: channels,
        length: Math.max(1, Math.ceil(seconds * sample_rate)),
        sampleRate: sample_rate,
    })
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        buffer.getChannelData(channel).fill(value)
    }
    return buffer
}

describe("concat_audio_buffers", () => {
    it("returns null for empty or all-null input", async () => {
        await expect(concat_audio_buffers({ buffers: [] })).resolves.toBeNull()
        await expect(concat_audio_buffers({ buffers: [null, null] })).resolves.toBeNull()
    })

    it("concatenates buffers in order with the expected length", async () => {
        const out = await concat_audio_buffers({
            buffers: [constant_buffer(0.5), constant_buffer(0.25)],
        })
        expect(out?.sampleRate).toBe(48000)
        expect(out?.numberOfChannels).toBe(2)
        expect(out?.length).toBe(96000)
        expect(out?.getChannelData(0)[0]).toBeCloseTo(0.5, 5)
        expect(out?.getChannelData(0)[48000]).toBeCloseTo(0.25, 2)
        expect(out?.getChannelData(0)[out.length - 1]).toBeCloseTo(0.25, 2)
    })

    it("skips null entries without inserting gaps", async () => {
        const out = await concat_audio_buffers({
            buffers: [constant_buffer(0.5, 0.5), null, constant_buffer(1, 0.5)],
        })
        expect(out?.length).toBe(48000)
        expect(out?.getChannelData(0)[0]).toBeCloseTo(0.5, 5)
        expect(out?.getChannelData(0)[24000]).toBeCloseTo(1, 2)
    })

    it("honors explicit rate and channel targets", async () => {
        const out = await concat_audio_buffers({
            buffers: [constant_buffer(0.5, 1, 48000, 1)],
            target_sample_rate: 48000,
            target_channels: 1,
        })
        expect(out?.sampleRate).toBe(48000)
        expect(out?.numberOfChannels).toBe(1)
        expect(out?.length).toBe(48000)
    })
})

describe("premix_compose_audio", () => {
    it("returns null when both inputs are missing", async () => {
        await expect(
            premix_compose_audio({ full_a: null, full_b: null, start_a: 0, blend_duration: 1, total_duration: 1 }),
        ).resolves.toBeNull()
    })

    it("renders a 48k stereo buffer of the expected length", async () => {
        const out = await premix_compose_audio({
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
})
