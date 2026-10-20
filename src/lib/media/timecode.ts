export class TimecodeError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "TimecodeError"
    }
}

const MM_SS = /^(\d+):(\d{1,2})\.(\d{1,3})$/
const HH_MM_SS = /^(\d+):(\d{1,2}):(\d{1,2})\.(\d{1,3})$/

function fraction_to_seconds(frac: string): number {
    return Number.parseInt(frac.padEnd(3, "0"), 10) / 1000
}

export function parseTimecode(raw: string): number {
    const value = raw.trim()
    let match = value.match(HH_MM_SS)
    if (match) {
        const [, h, m, s, ms] = match
        const minutes = Number.parseInt(m, 10)
        const seconds = Number.parseInt(s, 10)
        if (minutes > 59 || seconds > 59) {
            throw new TimecodeError(`Invalid timecode "${raw}": minutes and seconds must be below 60`)
        }
        return Number.parseInt(h, 10) * 3600 + minutes * 60 + seconds + fraction_to_seconds(ms)
    }
    match = value.match(MM_SS)
    if (match) {
        const [, m, s, ms] = match
        const seconds = Number.parseInt(s, 10)
        if (seconds > 59) {
            throw new TimecodeError(`Invalid timecode "${raw}": seconds must be below 60`)
        }
        return Number.parseInt(m, 10) * 60 + seconds + fraction_to_seconds(ms)
    }
    throw new TimecodeError(`Invalid timecode "${raw}": expected mm:ss.mmm or hh:mm:ss.mmm`)
}

export function formatTimecode(total_seconds: number): string {
    const total_ms = Math.round(Math.max(0, total_seconds) * 1000)
    const ms = total_ms % 1000
    const total_s = Math.floor(total_ms / 1000)
    const s = total_s % 60
    const total_m = Math.floor(total_s / 60)
    const pad = (n: number, len: number) => n.toString().padStart(len, "0")
    return `${pad(Math.floor(total_m / 60), 2)}:${pad(total_m % 60, 2)}:${pad(s, 2)}.${pad(ms, 3)}`
}

export function clampTimecode(start: number, end: number, duration: number | null): { start: number; end: number } {
    const hi = duration === null ? Number.POSITIVE_INFINITY : Math.max(0, duration)
    const clamped_start = Math.min(Math.max(0, start), hi)
    const clamped_end = Math.min(Math.max(0, end), hi)
    if (clamped_end <= clamped_start) {
        throw new TimecodeError("End time must be greater than start time")
    }
    return { start: clamped_start, end: clamped_end }
}
