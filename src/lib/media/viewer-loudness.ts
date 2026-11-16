export interface LoudnessCache {
    duration_s: number
    sample_rate: number
    buckets_per_sec: number
    peaks: Float32Array
    rms: Float32Array
    peak_overall: number
    rms_overall: number
    computed_at: number
}

export interface AnalyzeLoudnessOptions {
    file: Blob
    buckets_per_sec?: number
    signal?: AbortSignal
    on_progress?: (progress: number) => void
}

export interface LoudnessPoint {
    peak: number
    rms: number
    dbfs: number
}

export const LOUDNESS_BUCKETS_PER_SEC_DEFAULT = 8

function throw_if_aborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted) {
        throw new DOMException("Cancelled.", "AbortError")
    }
}

function resolve_buckets_per_sec(raw: number | undefined): number {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
        return LOUDNESS_BUCKETS_PER_SEC_DEFAULT
    }
    return Math.max(1, Math.floor(raw))
}

export function build_envelope(
    channel_data: Float32Array | ArrayLike<number>,
    bucket_count: number,
): { peaks: Float32Array; rms: Float32Array } {
    const total = Number.isFinite(bucket_count) ? Math.max(0, Math.floor(bucket_count)) : 0
    if (total === 0) {
        return { peaks: new Float32Array(0), rms: new Float32Array(0) }
    }
    const length = channel_data.length
    const peaks = new Float32Array(total)
    const rms = new Float32Array(total)
    if (length === 0) {
        return { peaks, rms }
    }
    const base = Math.floor(length / total)
    const remainder = length - base * total
    let offset = 0
    for (let bucket = 0; bucket < total; bucket += 1) {
        const size = base + (bucket < remainder ? 1 : 0)
        if (size <= 0) {
            continue
        }
        let peak = 0
        let sum_squares = 0
        for (let i = 0; i < size; i += 1) {
            const sample = Number(channel_data[offset + i])
            const safe = Number.isFinite(sample) ? sample : 0
            const abs = Math.abs(safe)
            if (abs > peak) {
                peak = abs
            }
            sum_squares += safe * safe
        }
        peaks[bucket] = peak
        rms[bucket] = Math.sqrt(sum_squares / size)
        offset += size
    }
    return { peaks, rms }
}

export function peak_to_dbfs(peak: number): number {
    if (!(peak > 0)) {
        return Number.NEGATIVE_INFINITY
    }
    return 20 * Math.log10(peak)
}

export function loudness_at(
    cache: LoudnessCache | null | undefined,
    time_s: number,
    window_s?: number,
): LoudnessPoint | null {
    if (!cache) {
        return null
    }
    const total = cache.peaks.length
    if (total === 0 || cache.rms.length !== total) {
        return null
    }
    if (!Number.isFinite(time_s)) {
        return null
    }
    const duration = Number.isFinite(cache.duration_s) ? Math.max(0, cache.duration_s) : 0
    const clamped = Math.min(Math.max(0, time_s), duration)
    const bps = cache.buckets_per_sec > 0 ? cache.buckets_per_sec : LOUDNESS_BUCKETS_PER_SEC_DEFAULT
    const at = (index: number): LoudnessPoint => {
        const peak = cache.peaks[index] ?? 0
        const rms_value = cache.rms[index] ?? 0
        return { peak, rms: rms_value, dbfs: peak_to_dbfs(peak) }
    }
    if (typeof window_s !== "number" || !Number.isFinite(window_s) || window_s <= 0) {
        const index = Math.min(total - 1, Math.floor(clamped * bps))
        return at(Math.max(0, index))
    }
    const half = window_s / 2
    const start = Math.max(0, clamped - half)
    const end = Math.min(duration, clamped + half)
    if (!(end > start)) {
        const index = Math.min(total - 1, Math.floor(clamped * bps))
        return at(Math.max(0, index))
    }
    const start_index = Math.max(0, Math.floor(start * bps))
    const end_index = Math.min(total - 1, Math.floor((end - 1e-9) * bps))
    if (end_index <= start_index) {
        return at(Math.min(total - 1, Math.max(0, start_index)))
    }
    let peak = 0
    let sum_squares = 0
    const count = end_index - start_index + 1
    for (let index = start_index; index <= end_index; index += 1) {
        const bucket_peak = cache.peaks[index] ?? 0
        const bucket_rms = cache.rms[index] ?? 0
        if (bucket_peak > peak) {
            peak = bucket_peak
        }
        sum_squares += bucket_rms * bucket_rms
    }
    const rms_value = Math.sqrt(sum_squares / count)
    return { peak, rms: rms_value, dbfs: peak_to_dbfs(peak) }
}

export async function analyze_loudness(options: AnalyzeLoudnessOptions): Promise<LoudnessCache | null> {
    const { file, signal, on_progress } = options
    throw_if_aborted(signal)
    const buckets_per_sec = resolve_buckets_per_sec(options.buckets_per_sec)
    const mb = await import("mediabunny")
    throw_if_aborted(signal)
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) })
    try {
        const audio_tracks = await input.getAudioTracks()
        throw_if_aborted(signal)
        const track = audio_tracks[0]
        if (!track) {
            return null
        }
        const sink = new mb.AudioBufferSink(track)
        const chunks: AudioBuffer[] = []
        for await (const wrapped of sink.buffers()) {
            throw_if_aborted(signal)
            chunks.push(wrapped.buffer)
        }
        throw_if_aborted(signal)
        const first = chunks[0]
        if (!first) {
            return null
        }
        let total_length = 0
        for (const chunk of chunks) {
            throw_if_aborted(signal)
            total_length += chunk.length
        }
        if (total_length === 0) {
            return null
        }
        const channels = first.numberOfChannels
        const sample_rate = first.sampleRate
        const full =
            chunks.length === 1
                ? first
                : (() => {
                      const combined = new AudioBuffer({
                          numberOfChannels: channels,
                          length: total_length,
                          sampleRate: sample_rate,
                      })
                      let offset = 0
                      for (const chunk of chunks) {
                          for (let channel = 0; channel < channels; channel += 1) {
                              combined
                                  .getChannelData(channel)
                                  .set(chunk.getChannelData(Math.min(channel, chunk.numberOfChannels - 1)), offset)
                          }
                          offset += chunk.length
                      }
                      return combined
                  })()
        throw_if_aborted(signal)
        const length = full.length
        const mono = new Float32Array(length)
        const channel_count = full.numberOfChannels
        for (let channel = 0; channel < channel_count; channel += 1) {
            throw_if_aborted(signal)
            const data = full.getChannelData(channel)
            if (channel_count === 1) {
                mono.set(data)
            } else {
                for (let i = 0; i < length; i += 1) {
                    const sample = data[i]
                    mono[i] += (Number.isFinite(sample) ? sample : 0) / channel_count
                }
            }
        }
        const duration_s = Number.isFinite(full.duration) ? full.duration : length / sample_rate
        const bucket_count = Math.max(1, Math.round(duration_s * buckets_per_sec))
        const peaks = new Float32Array(bucket_count)
        const rms = new Float32Array(bucket_count)
        const base = Math.floor(length / bucket_count)
        const remainder = length - base * bucket_count
        let offset = 0
        let peak_overall = 0
        let sum_squares_total = 0
        for (let bucket = 0; bucket < bucket_count; bucket += 1) {
            throw_if_aborted(signal)
            const size = base + (bucket < remainder ? 1 : 0)
            if (size <= 0) {
                continue
            }
            let peak = 0
            let sum_squares = 0
            for (let i = 0; i < size; i += 1) {
                const sample = mono[offset + i] ?? 0
                const safe = Number.isFinite(sample) ? sample : 0
                const abs = Math.abs(safe)
                if (abs > peak) {
                    peak = abs
                }
                sum_squares += safe * safe
            }
            peaks[bucket] = peak
            rms[bucket] = Math.sqrt(sum_squares / size)
            if (peak > peak_overall) {
                peak_overall = peak
            }
            sum_squares_total += sum_squares
            offset += size
            on_progress?.((bucket + 1) / bucket_count)
        }
        return {
            duration_s,
            sample_rate,
            buckets_per_sec,
            peaks,
            rms,
            peak_overall,
            rms_overall: length > 0 ? Math.sqrt(sum_squares_total / length) : 0,
            computed_at: Date.now(),
        }
    } finally {
        input.dispose()
    }
}
