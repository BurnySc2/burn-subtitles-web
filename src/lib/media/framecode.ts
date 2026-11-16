import { format_timecode } from "./timecode"
import { effective_fps, time_to_frame } from "./viewer-step"

export function format_framecode(time_s: number, fps: number): string {
    const rate = Math.max(1, Math.round(effective_fps(fps)))
    const safe_time = Math.max(0, time_s)
    const total_s = Math.floor(safe_time)
    const pad = (n: number) => n.toString().padStart(2, "0")
    const frame = time_to_frame(safe_time, rate) % rate
    return `${pad(Math.floor(total_s / 3600))}:${pad(Math.floor(total_s / 60) % 60)}:${pad(total_s % 60)}:${pad(frame)}`
}

export function format_viewer_time(time_s: number): string {
    return format_timecode(time_s)
}

export function format_viewer_summary(time_s: number, fps: number, duration: number | null): string {
    const rate = effective_fps(fps)
    const head = `${format_timecode(time_s)} (f${time_to_frame(time_s, rate)} @${rate}fps)`
    return duration === null ? head : `${head} / ${format_timecode(duration)}`
}

export async function copy_text(text: string): Promise<boolean> {
    try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
        if (typeof document === "undefined") {
            return false
        }
        const area = document.createElement("textarea")
        area.value = text
        area.style.position = "fixed"
        area.style.opacity = "0"
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand("copy")
        document.body.removeChild(area)
        return ok
    } catch {
        return false
    }
}
