import { type PremixTransitionAudioOptions, premix_transition_audio } from "./transition-audio"

export interface ConcatAudioBuffersOptions {
    buffers: Array<AudioBuffer | null>
    target_sample_rate?: number
    target_channels?: number
}

export type PremixComposeAudioOptions = PremixTransitionAudioOptions

export async function concat_audio_buffers(options: ConcatAudioBuffersOptions): Promise<AudioBuffer | null> {
    const present = options.buffers.filter((buffer): buffer is AudioBuffer => buffer !== null)
    if (present.length === 0) {
        return null
    }
    const fallback_rate = present[0]?.sampleRate ?? 48000
    const fallback_channels = present.reduce((peak, buffer) => Math.max(peak, buffer.numberOfChannels), 0)
    const requested_rate = options.target_sample_rate ?? fallback_rate
    const requested_channels = options.target_channels ?? fallback_channels
    const sample_rate = Number.isFinite(requested_rate) && requested_rate > 0 ? Math.round(requested_rate) : 48000
    const channels = Number.isInteger(requested_channels) && requested_channels > 0 ? requested_channels : 2
    const total = present.reduce((sum, buffer) => sum + buffer.duration, 0)
    if (!Number.isFinite(total) || total <= 0) {
        return null
    }
    const ctx = new OfflineAudioContext(channels, Math.max(1, Math.ceil(total * sample_rate)), sample_rate)
    let offset = 0
    for (const buffer of present) {
        if (!(buffer.duration > 0)) {
            continue
        }
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.channelInterpretation = "speakers"
        source.connect(ctx.destination)
        source.start(offset)
        offset += buffer.duration
    }
    return ctx.startRendering()
}

export function premix_compose_audio(options: PremixComposeAudioOptions): Promise<AudioBuffer | null> {
    return premix_transition_audio(options)
}
