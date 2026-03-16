import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
import { available_fonts } from "./fonts"

export async function load_selected_font(): Promise<boolean> {
    // Loads and writes selected font into /tmp folder for ffmpeg to read
    if (!temp_state.ffmpeg.ffmpeg) {
        return false
    }

    const selected_font = available_fonts[perma_state.subtitle_settings.font.index]
    try {
        temp_state.ffmpeg.message = `Loading font: ${selected_font.select_name}`

        // For local fonts in /fonts/ folder, we need to fetch them as resources
        const font_response = await fetch(selected_font.url)
        if (!font_response.ok) {
            throw new Error(`Failed to fetch font: ${font_response.statusText}`)
        }
        const font_buffer = await font_response.arrayBuffer()
        await temp_state.ffmpeg.ffmpeg.writeFile(`/tmp/${selected_font.filename}`, new Uint8Array(font_buffer))
        console.log(`Font ${selected_font.select_name} loaded to /tmp`)
        return true
    } catch (err) {
        console.error("Failed to load font:", err)
        temp_state.ffmpeg.error_message = `Failed to load font ${selected_font.select_name}: ${err}`
        temp_state.ffmpeg.message = "Font load failed"
        return false
    }
}

// Helper function to convert hex color to ASS format
function hex_to_ass(hex_color: string): string {
    // Remove # if present
    const hex = hex_color.replace(/^#/, "")

    // Validate hex format
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
        throw new Error(`Invalid hex color format: ${hex_color}. Expected RRGGBB format.`)
    }

    // Parse RGB components
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    // Validate RGB values are within valid range
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        throw new Error(`Invalid RGB values in hex color: ${hex_color}`)
    }

    // Convert to ASS format (BBGGRR)
    return `${b.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${r.toString(16).padStart(2, "0")}`
}

// Helper function to parse SRT file and convert to ASS dialogues
function parse_srt_to_dialogues(srt_content: string): Array<{
    start: string
    end: string
    text: string
}> {
    const dialogues: Array<{ start: string; end: string; text: string }> = []
    const blocks = srt_content.trim().split(/\n\s*\n/)

    for (const block of blocks) {
        const lines = block.trim().split("\n")
        if (lines.length >= 3) {
            const _index = lines[0]
            const time_line = lines[1]
            const text = lines.slice(2).join("\n")

            // Parse time line: 00:00:000 --> 00:00:000
            const time_match = time_line.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/)
            if (time_match) {
                dialogues.push({
                    start: time_match[1],
                    end: time_match[2],
                    text: text.trim(),
                })
            }
        }
    }

    return dialogues
}

// Helper function to escape special characters in ASS text
function escape_ass_text(text: string): string[] {
    // Escape ASS special characters: {, }, \\n

    // Split at newline (\n) characters, needs to be joined with ASS newline character  ("\\N")
    const lines = text.split("\n")

    return lines.map((line) => {
        return (
            line
                // Escape all curly brackets
                .replaceAll(/[{}]/g, "\\$&")
                // Remove additional spaces
                .replaceAll(/\s+/g, " ")
        )
    })
}

// Generate ASS file from SRT content and styling parameters
export function generate_ass_file(srt_content?: string): string {
    const alignment_map = {
        top: "8",
        bottom: "2",
        center: "5",
    } as const

    const state = perma_state.subtitle_settings

    const ass_header = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

Style: Default,${available_fonts[state.font.index].font_family},${state.font.size},&H${hex_to_ass(state.text.color)},&H000000,&H${hex_to_ass(state.text.stroke)},&H000000,0,0,0,0,100,100,0,0,1,${state.text.outline_size},${state.shadow.size},${alignment_map[state.position.vertical_anchor]},${state.position.horizontal_margin},${state.position.horizontal_margin},${state.position.vertical},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

    const dialogues = srt_content ? parse_srt_to_dialogues(srt_content) : []
    const dialogue_lines = dialogues
        .map((d) => {
            // Convert SRT time format (HH:MM:SS) to ASS time format (H:MM:SS.CC)
            const format_time = (time_str: string) => {
                const [hours_str, minutes_str, seconds_milliseconds_str] = time_str.split(":")
                const [seconds_str, milliseconds_str] = seconds_milliseconds_str.split(",")
                const [hours, minutes, seconds, milliseconds] = [
                    hours_str,
                    minutes_str,
                    seconds_str,
                    milliseconds_str.slice(0, 2),
                ].map(Number)
                // Use format: H:MM:SS.mmm (e.g., 0:00:10.000, 1:05:30.000)
                return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`
            }

            // Add RTL support using Unicode characters
            const lines = escape_ass_text(d.text)
            const rtl_corrected_lines = lines.map((line) => (state.font.right_to_left ? `\u202B${line}\u202C` : line))
            const joined = rtl_corrected_lines.join("\\N")

            return `Dialogue: 0,${format_time(d.start)},${format_time(d.end)},Default,,0,0,0,,${joined}`
        })
        .join("\n")

    return ass_header + (dialogue_lines ? `\n${dialogue_lines}` : "")
}

export function download_video(): void {
    if (temp_state.ffmpeg.output_blob && temp_state.ffmpeg.output_url) {
        const a = document.createElement("a")
        a.href = temp_state.ffmpeg.output_url
        a.download = `subtitled-${temp_state.ffmpeg.video_file?.name.replace(/\.[^/.]+$/, "") || "video"}.mp4`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }
}
