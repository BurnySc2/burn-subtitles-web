import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
import { available_fonts } from "$lib/utils/fonts"
import { get_config, type QualityMode } from "$lib/utils/video-processing"

export async function download_ass_file(ass_content: string | null | Promise<string | null>) {
    if (!temp_state.ffmpeg.srt_file) {
        temp_state.ffmpeg.error_message = "Please upload an SRT file first"
        return
    }
    const content = await ass_content
    if (content === null) {
        return
    }
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "styled_subtitles.ass"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

export async function download_selected_font() {
    const selected_font = available_fonts[perma_state.subtitle_settings.font.index]
    if (!selected_font) {
        return
    }
    const response = await fetch(selected_font.url)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = selected_font.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

export function build_ffmpeg_command(
    video_file: File | null,
    srt_file: File | null,
    selected_quality_mode: string,
    _selected_font_index: number,
): string | null {
    if (!video_file || !srt_file) {
        return null
    }
    const config = get_config(selected_quality_mode as QualityMode)
    return `ffmpeg -i input.mp4 -vf "ass=subtitles.ass:fontsdir=." -c:v libx264 -preset ${config.preset} -crf ${config.crf} -pix_fmt yuv420p -c:a aac -b:a ${config.audio_bitrate} -y output.mp4`
}

export function get_selected_font_name(index: number): string {
    return available_fonts[index]?.font_family ?? "Unknown"
}
