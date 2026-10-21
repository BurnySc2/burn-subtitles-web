import { clip_basename } from "./clip-filename"

function format_duration_label(duration_sec: number): string {
    if (!Number.isFinite(duration_sec) || duration_sec <= 0) {
        return "1"
    }
    return String(Math.round(duration_sec * 1000) / 1000)
}

export function transition_filename(
    source_a_name: string,
    source_b_name: string,
    total_sec: number,
    extension: string,
): string {
    const ext = extension.replace(/^\./, "") || "mp4"
    const label = format_duration_label(total_sec)
    return `${clip_basename(source_a_name)}_x_${clip_basename(source_b_name)}_${label}s.${ext}`
}
