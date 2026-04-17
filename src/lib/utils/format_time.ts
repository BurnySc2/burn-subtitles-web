export function parse_timestamp(timestamp: string): number {
    const parts = timestamp.split(":").map(Number)
    if (parts.length !== 3) {
        throw new Error("Invalid timestamp format. Use hh:mm:ss")
    }
    const [hours, minutes, seconds] = parts
    return hours * 3600 + minutes * 60 + seconds
}

// Parse mm:ss.ms or mm:ss.mmm format to seconds
export function parse_clip_timestamp(timestamp: string): number {
    const match = timestamp.match(/^(\d+):(\d+)\.(\d+)$/)
    if (!match) {
        throw new Error("Invalid timestamp format. Use mm:ss.mmm")
    }
    const [, minutes, seconds, ms] = match
    return parseInt(minutes, 10) * 60 + parseInt(seconds, 10) + parseInt(ms, 10) / 1000
}

// Format seconds to mm:ss.mmm
export function format_to_clip_timestamp(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const ms = Math.round((totalSeconds % 1) * 1000)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`
}

export function format_time_remaining(processing_start_time: number | null, progress: number): string {
    if (!processing_start_time || progress <= 0 || progress >= 100) {
        return ""
    }

    const estimated_total_duration_ms = (100 * (Date.now() - processing_start_time)) / progress
    const elapsed_ms = Date.now() - processing_start_time
    const remaining_s = (estimated_total_duration_ms - elapsed_ms) / 1000

    // console.log([estimated_total_duration_ms, elapsed_ms, remaining_s])

    if (remaining_s < 0) {
        return "Finishing up..."
    }

    const minutes = Math.floor(remaining_s / 60)
    const seconds = Math.floor(remaining_s % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`
}
