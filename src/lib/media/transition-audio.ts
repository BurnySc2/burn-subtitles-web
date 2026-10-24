import { ClipError } from "./mediabunny-clip"
import {
    EASING_REGISTRY,
    TRANSITION_AUDIO_MODE_DEFAULT,
    TRANSITION_AUDIO_MODES,
    type TransitionAudioMode,
    type TransitionEasing,
} from "./transition-utils"

export interface PremixTransitionAudioOptions {
    full_a: AudioBuffer | null
    full_b: AudioBuffer | null
    start_a: number
    blend_duration: number
    total_duration: number
    target_sample_rate?: number
    target_channels?: number
    easing?: TransitionEasing
    audio_mode?: TransitionAudioMode
}

function attach_source(
    ctx: OfflineAudioContext,
    buffer: AudioBuffer,
    when: number,
    offset: number,
    gain: GainNode,
): void {
    const start_when = Number.isFinite(when) ? Math.max(0, when) : 0
    const start_at = Number.isFinite(offset) ? Math.max(0, offset) : 0
    if (start_at >= buffer.duration) {
        return
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.channelInterpretation = "speakers"
    source.connect(gain)
    source.start(start_when, start_at)
}

export async function premix_transition_audio(options: PremixTransitionAudioOptions): Promise<AudioBuffer | null> {
    const { full_a, full_b, start_a, blend_duration, total_duration } = options
    if (!full_a && !full_b) {
        return null
    }
    if (!Number.isFinite(total_duration) || total_duration <= 0) {
        return null
    }
    const requested_rate = options.target_sample_rate ?? 48000
    const requested_channels = options.target_channels ?? 2
    const sample_rate = Number.isFinite(requested_rate) && requested_rate > 0 ? requested_rate : 48000
    const channels = Number.isInteger(requested_channels) && requested_channels > 0 ? requested_channels : 2
    const ease = EASING_REGISTRY[options.easing ?? "linear"] ?? EASING_REGISTRY.linear
    const mode = options.audio_mode ?? TRANSITION_AUDIO_MODE_DEFAULT
    if (!TRANSITION_AUDIO_MODES.includes(mode)) {
        throw new ClipError("INVALID_RANGE", "Unknown transition audio mode.")
    }
    const length = Math.max(1, Math.ceil(total_duration * sample_rate))
    const ctx = new OfflineAudioContext(channels, length, sample_rate)
    const blend_start = Number.isFinite(start_a) ? Math.min(Math.max(start_a, 0), total_duration) : 0
    const blend_len = Number.isFinite(blend_duration)
        ? Math.min(Math.max(blend_duration, 0), Math.max(0, total_duration - blend_start))
        : Math.max(0, total_duration - blend_start)
    const gain_a = ctx.createGain()
    const gain_b = ctx.createGain()
    gain_a.connect(ctx.destination)
    gain_b.connect(ctx.destination)
    if (mode === "a-only") {
        gain_a.gain.setValueAtTime(1, 0)
        gain_b.gain.setValueAtTime(0, 0)
    } else if (mode === "b-only") {
        gain_a.gain.setValueAtTime(0, 0)
        gain_b.gain.setValueAtTime(1, 0)
    } else if (blend_len <= 0) {
        gain_a.gain.setValueAtTime(1, 0)
        gain_a.gain.setValueAtTime(0, blend_start)
        gain_b.gain.setValueAtTime(0, 0)
        gain_b.gain.setValueAtTime(1, blend_start)
    } else if (mode === "a-flat") {
        gain_a.gain.setValueAtTime(1, 0)
        gain_a.gain.setValueAtTime(1, blend_start)
        gain_a.gain.setValueAtTime(0, blend_start + blend_len)
        gain_b.gain.setValueAtTime(0, 0)
        gain_b.gain.setValueAtTime(0, blend_start)
        gain_b.gain.setValueAtTime(1, blend_start + blend_len)
    } else if (mode === "mute") {
        gain_a.gain.setValueAtTime(1, 0)
        gain_a.gain.setValueAtTime(0, blend_start)
        gain_a.gain.setValueAtTime(0, blend_start + blend_len)
        gain_b.gain.setValueAtTime(0, 0)
        gain_b.gain.setValueAtTime(0, blend_start)
        gain_b.gain.setValueAtTime(1, blend_start + blend_len)
    } else if (mode === "a-fadeout") {
        const points = 256
        const curve_a = new Float32Array(points)
        for (let i = 0; i < points; i += 1) {
            curve_a[i] = 1 - ease(i / (points - 1))
        }
        gain_a.gain.setValueAtTime(1, 0)
        gain_a.gain.setValueAtTime(1, blend_start)
        gain_b.gain.setValueAtTime(0, 0)
        gain_b.gain.setValueAtTime(0, blend_start)
        gain_a.gain.setValueCurveAtTime(curve_a, blend_start, blend_len)
        gain_b.gain.setValueAtTime(1, blend_start + blend_len)
    }
    // WHY asymmetric flats: a-flat holds A flat while B waits until blend end; b-flat pre-echoes B
    // from t=0 while A still fades (1-alpha) in blend. Per-leg gains [solo-a, blend-start, blend-end]:
    // crossfade A[1,1,1-a]/B[0,0,a], a-flat A[1,1,0]/B[0,0,1], a-fadeout A[1,1,1-e]/B[0,0,1],
    // b-flat A[1,1,1-e]/B[0,1,1], b-fadein A[1,0,0]/B[0,0,e], mute A[1,0,0]/B[0,0,1], dip A[1,1,V]/B[0,0,V],
    // a-only A[1]/B[0] full_a@0, b-only A[0]/B[1] full_b@0 (constant gains, easing ignored).
    else if (mode === "b-flat") {
        const points = 256
        const curve_a = new Float32Array(points)
        for (let i = 0; i < points; i += 1) {
            curve_a[i] = 1 - ease(i / (points - 1))
        }
        gain_a.gain.setValueAtTime(1, 0)
        gain_a.gain.setValueAtTime(1, blend_start)
        gain_b.gain.setValueAtTime(0, 0)
        gain_b.gain.setValueAtTime(1, blend_start)
        gain_a.gain.setValueCurveAtTime(curve_a, blend_start, blend_len)
        gain_b.gain.setValueAtTime(1, blend_start + blend_len)
    } else if (mode === "b-fadein") {
        const points = 256
        const curve_b = new Float32Array(points)
        for (let i = 0; i < points; i += 1) {
            curve_b[i] = ease(i / (points - 1))
        }
        gain_a.gain.setValueAtTime(1, 0)
        gain_a.gain.setValueAtTime(0, blend_start)
        gain_a.gain.setValueAtTime(0, blend_start + blend_len)
        gain_b.gain.setValueAtTime(0, 0)
        gain_b.gain.setValueAtTime(0, blend_start)
        gain_b.gain.setValueCurveAtTime(curve_b, blend_start, blend_len)
    } else if (mode === "dip") {
        const points = 256
        const curve_a = new Float32Array(points)
        const curve_b = new Float32Array(points)
        for (let i = 0; i < points; i += 1) {
            const alpha = ease(i / (points - 1))
            curve_a[i] = Math.max(0, 1 - 2 * alpha)
            curve_b[i] = Math.max(0, 2 * alpha - 1)
        }
        gain_a.gain.setValueAtTime(1, 0)
        gain_a.gain.setValueAtTime(1, blend_start)
        gain_b.gain.setValueAtTime(0, 0)
        gain_b.gain.setValueAtTime(0, blend_start)
        gain_a.gain.setValueCurveAtTime(curve_a, blend_start, blend_len)
        gain_b.gain.setValueCurveAtTime(curve_b, blend_start, blend_len)
    } else {
        const points = 256
        const curve_a = new Float32Array(points)
        const curve_b = new Float32Array(points)
        for (let i = 0; i < points; i += 1) {
            const alpha = ease(i / (points - 1))
            curve_a[i] = 1 - alpha
            curve_b[i] = alpha
        }
        gain_a.gain.setValueAtTime(1, 0)
        gain_a.gain.setValueAtTime(1, blend_start)
        gain_b.gain.setValueAtTime(0, 0)
        gain_b.gain.setValueAtTime(0, blend_start)
        gain_a.gain.setValueCurveAtTime(curve_a, blend_start, blend_len)
        gain_b.gain.setValueCurveAtTime(curve_b, blend_start, blend_len)
    }
    if (mode === "a-only") {
        if (full_a) {
            attach_source(ctx, full_a, 0, 0, gain_a)
        }
    } else if (mode === "b-only") {
        if (full_b) {
            attach_source(ctx, full_b, 0, 0, gain_b)
        }
    } else if (full_a) {
        attach_source(ctx, full_a, 0, 0, gain_a)
    }
    if (mode !== "a-only" && mode !== "b-only" && full_b) {
        attach_source(ctx, full_b, blend_start, 0, gain_b)
    }
    return ctx.startRendering()
}
