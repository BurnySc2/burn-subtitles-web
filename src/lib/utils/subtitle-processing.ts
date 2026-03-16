import { FFmpeg } from "@ffmpeg/ffmpeg"
// @ts-expect-error
import type { LogEvent, ProgressEvent } from "@ffmpeg/ffmpeg/dist/esm/types"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"

export type QualityMode = "high" | "preview"

export type FfmpegConfig = {
    preset: string
    crf: string
    audio_bitrate: string
}

export type FontOption = {
    font_family: string
    select_name: string
    url: string
    filename: string
    font_weight?: "normal" | "bold"
}

export type ProcessingState = {
    ffmpeg: FFmpeg | null
    is_processing: boolean
    is_rendering_preview: boolean
    progress: number
    output_blob: Blob | null
    output_url: string | null
    preview_url: string | null
    message: string
    error_message: string | null
    processing_start_time: number | null
    estimated_total_duration: number
    selected_quality_mode: QualityMode
    selected_font_index: number
    font_size: number
    is_bold: boolean
    position: "top" | "bottom" | "center"
    preview_timestamp: string
    video_file: File | null
    srt_file: File | null
}

export type ASSProcessingState = ProcessingState & {
    text_color: string // #ffff7f
    font_size: number // 70
    stroke_size: number // 2 (fixed)
    stroke_color: string // #000000
    shadow_blur: number // 0-4
    subtitle_horizontal_margin: number // left and right margin / space
    subtitle_position_y: number // 140
    subtitle_center_x: number // 960
    RTL: boolean // Right-to-left text support
}

export const high_quality_config: FfmpegConfig = {
    preset: "veryslow",
    crf: "18",
    audio_bitrate: "320k",
}

export const preview_config: FfmpegConfig = {
    preset: "ultrafast",
    crf: "28",
    audio_bitrate: "128k",
}

export const get_config = (mode: QualityMode = "preview"): FfmpegConfig => {
    return mode === "high" ? high_quality_config : preview_config
}

export const available_fonts: FontOption[] = [
    // Needs to be in sync with +layout.svelte font-face
    // Always download the Font-Regular version
    // https://fonts.google.com
    {
        font_family: "Arial",
        select_name: "Arial",
        url: "/fonts/Arial.ttf",
        filename: "Arial.ttf",
    },
    {
        font_family: "Cairo",
        select_name: "Cairo",
        url: "/fonts/Cairo.ttf",
        filename: "Cairo.ttf",
    },
    {
        font_family: "Candara",
        select_name: "Candara",
        url: "/fonts/Candara.ttf",
        filename: "Candara.ttf",
    },
    {
        font_family: "Lateef",
        select_name: "Lateef",
        url: "/fonts/Lateef.ttf",
        filename: "Lateef.ttf",
    },
    {
        font_family: "MaruBuri",
        select_name: "MaruBuri",
        url: "/fonts/MaruBuri.ttf",
        filename: "MaruBuri.ttf",
    },
    {
        font_family: "Noto Kufi Arabic",
        select_name: "Noto Kufi Arabic",
        url: "/fonts/NotoKufiArabic.ttf",
        filename: "NotoKufiArabic.ttf",
    },
    {
        font_family: "Noto Sans",
        select_name: "Noto Sans",
        url: "/fonts/NotoSans.ttf",
        filename: "NotoSans.ttf",
    },
    {
        font_family: "Noto Sans Arabic",
        select_name: "Noto Sans Arabic",
        url: "/fonts/NotoSansArabic.ttf",
        filename: "NotoSansArabic.ttf",
    },
    {
        font_family: "Noto Sans Japanese",
        select_name: "Noto Sans Japanese",
        url: "/fonts/NotoSansJP.ttf",
        filename: "NotoSansJP.ttf",
    },
    {
        font_family: "Noto Sans Korean",
        select_name: "Noto Sans Korean",
        url: "/fonts/NotoSansKR.ttf",
        filename: "NotoSansKR.ttf",
    },
    {
        font_family: "Noto Sans Thai",
        select_name: "Noto Sans Thai",
        url: "/fonts/NotoSansThai.ttf",
        filename: "NotoSansThai.ttf",
    },
    {
        font_family: "Noto Sans Traditional Chinese",
        select_name: "Noto Sans Traditional Chinese",
        url: "/fonts/NotoSansTC.ttf",
        filename: "NotoSansTC.ttf",
    },
    {
        font_family: "OpenSans",
        select_name: "OpenSans",
        url: "/fonts/OpenSans.ttf",
        filename: "OpenSans.ttf",
    },
    {
        font_family: "Roboto",
        select_name: "Roboto",
        url: "/fonts/Roboto.ttf",
        filename: "Roboto.ttf",
    },
    {
        font_family: "Rubik",
        select_name: "Rubik",
        url: "/fonts/Rubik.ttf",
        filename: "Rubik.ttf",
    },
    // Copyright issues? https://font.download/font/tahoma
    {
        font_family: "Tahoma",
        select_name: "Tahoma",
        url: "/fonts/Tahoma.ttf",
        filename: "Tahoma.ttf",
    },
    {
        font_family: "Tajawal",
        select_name: "Tajawal",
        url: "/fonts/Tajawal.ttf",
        filename: "Tajawal.ttf",
    },
    {
        font_family: "Vazirmatn",
        select_name: "VazirmatnRegular",
        url: "/fonts/VazirmatnRegular.ttf",
        filename: "VazirmatnRegular.ttf",
    },
    {
        font_family: "Vazirmatn",
        select_name: "VazirmatnBold",
        url: "/fonts/VazirmatnBold.ttf",
        filename: "VazirmatnBold.ttf",
        font_weight: "bold",
    },
]

const base_url = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm"

export function create_initial_state(): ProcessingState {
    return {
        ffmpeg: null,
        is_processing: false,
        is_rendering_preview: false,
        progress: 0,
        output_blob: null,
        output_url: null,
        preview_url: null,
        message: "Ready to process",
        error_message: null,
        processing_start_time: null,
        estimated_total_duration: 0,
        selected_quality_mode: "preview",
        selected_font_index: 0,
        font_size: 24,
        is_bold: false,
        position: "bottom",
        preview_timestamp: "00:00:05",
        video_file: null,
        srt_file: null,
    }
}

export function parse_timestamp(timestamp: string): number {
    const parts = timestamp.split(":").map(Number)
    if (parts.length !== 3) {
        throw new Error("Invalid timestamp format. Use hh:mm:ss")
    }
    const [hours, minutes, seconds] = parts
    return hours * 3600 + minutes * 60 + seconds
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

export async function load_ffmpeg() {
    if (temp_state.ffmpeg.ffmpeg) {
        return
    }

    const new_ffmpeg = new FFmpeg()

    new_ffmpeg.on("log", ({ message: msg }: LogEvent) => {
        console.log("FFmpeg log:", msg)
        // Don't update UI message with technical logs
    })

    new_ffmpeg.on("progress", ({ progress: p }: ProgressEvent) => {
        temp_state.ffmpeg.progress = Math.round(p * 100)
    })

    try {
        temp_state.ffmpeg.message = "Loading FFmpeg core"
        await new_ffmpeg.load({
            coreURL: await toBlobURL(`${base_url}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${base_url}/ffmpeg-core.wasm`, "application/wasm"),
        })

        temp_state.ffmpeg.message = "FFmpeg loaded successfully"
        temp_state.ffmpeg.ffmpeg = new_ffmpeg
    } catch (err) {
        console.error("Failed to load FFmpeg:", err)
        temp_state.ffmpeg.error_message = "Failed to initialize FFmpeg"
        temp_state.ffmpeg.message = "FFmpeg load failed"
        return
    }
}

export async function load_selected_font(): Promise<boolean> {
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

// Helper function to clean up FFmpeg files
async function cleanup_ffmpeg_files() {
    if (!temp_state.ffmpeg.ffmpeg) {
        return
    }
    if (temp_state.ffmpeg.video_file) {
        await temp_state.ffmpeg.ffmpeg.deleteFile(temp_state.ffmpeg.video_file.name).catch(() => {})
    }
    if (temp_state.ffmpeg.srt_file) {
        await temp_state.ffmpeg.ffmpeg.deleteFile(temp_state.ffmpeg.srt_file.name).catch(() => {})
    }
    if (temp_state.ffmpeg.font_file) {
        await temp_state.ffmpeg.ffmpeg.deleteFile(`/tmp/${temp_state.ffmpeg.font_file}`).catch(() => {})
    }
    if (temp_state.ffmpeg.output_blob) {
        await temp_state.ffmpeg.ffmpeg.deleteFile(temp_state.ffmpeg.output_blob.name).catch(() => {})
    }
}

// Helper function to write video and subtitle files to FFmpeg
async function write_input_files() {
    if (!temp_state.ffmpeg.ffmpeg || !temp_state.ffmpeg.video_file || !temp_state.ffmpeg.srt_file) {
        return
    }
    await temp_state.ffmpeg.ffmpeg.writeFile(
        `input.${temp_state.ffmpeg.video_file.name.split(".").pop() || "mp4"}`,
        await fetchFile(temp_state.ffmpeg.video_file),
    )
    const srt_bytes = new TextEncoder().encode(await temp_state.ffmpeg.srt_file.text())
    await temp_state.ffmpeg.ffmpeg.writeFile("subtitles.srt", srt_bytes)
}

// Helper function to initialize FFmpeg and load font
async function initialize_ffmpeg_and_load_font() {
    await load_ffmpeg()
    if (!temp_state.ffmpeg.ffmpeg) {
        return
    }

    const font_loaded = await load_selected_font()
    if (!font_loaded) {
        return
    }
}

export function build_force_style(): string {
    const is_bold = available_fonts[perma_state.subtitle_settings.font.index].font_weight === "bold"
    const bold_style = is_bold ? ",Bold=-1" : ""
    const alignment_map = {
        top: "8",
        bottom: "2",
        center: "5",
    }
    const alignment = alignment_map[perma_state.subtitle_settings.position.vertical_anchor]
    const font_name = available_fonts[perma_state.subtitle_settings.font.index].font_family
    return `Fontname=${font_name},FontSize=${perma_state.subtitle_settings.font.size}${bold_style},Alignment=${alignment}`
}

export async function render_frame_preview(): Promise<void> {
    if (!temp_state.ffmpeg.video_file || !temp_state.ffmpeg.srt_file) {
        temp_state.ffmpeg.error_message = "Please upload both video and SRT files"
        return
    }

    await initialize_ffmpeg_and_load_font()
    if (!temp_state.ffmpeg.ffmpeg) {
        return
    }

    temp_state.ffmpeg.message = "Rendering frame preview..."

    if (temp_state.ffmpeg.preview_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
    }

    const timestamp_seconds = parse_timestamp(temp_state.ffmpeg.preview_timestamp)
    if (timestamp_seconds < 0) {
        temp_state.ffmpeg.error_message = "Timestamp must be positive"
        return
    }

    const video_ext = temp_state.ffmpeg.video_file.name.split(".").pop() || "mp4"
    const video_name = `input.${video_ext}`
    const srt_name = "subtitles.srt"
    const output_name = "preview.png"

    try {
        // Write input files
        await write_input_files()

        // Build force_style for preview
        const force_style = build_force_style()

        // Execute FFmpeg command for frame extraction with subtitles
        const vf_filter = `subtitles=${srt_name}:fontsdir=/tmp:force_style='${force_style}'`
        await temp_state.ffmpeg.ffmpeg.exec([
            "-i",
            video_name,
            "-ss",
            timestamp_seconds.toString(),
            "-avoid_negative_ts",
            "make_zero",
            "-vf",
            vf_filter,
            "-frames:v",
            "1",
            "-update",
            "1",
            "-y",
            output_name,
        ])

        // Read output
        const frame_data = await temp_state.ffmpeg.ffmpeg.readFile(output_name)
        // @ts-expect-error
        const frame_blob = new Blob([(frame_data as Uint8Array).buffer], {
            type: "image/png",
        })
        const preview_url = URL.createObjectURL(frame_blob)

        // Cleanup
        await cleanup_ffmpeg_files()

        temp_state.ffmpeg.message = `Frame preview rendered at ${temp_state.ffmpeg.preview_timestamp}`

        temp_state.ffmpeg.is_rendering_preview = false
        temp_state.ffmpeg.progress = 100
    } catch (err) {
        console.error("Frame preview failed:", err)
        temp_state.ffmpeg.error_message = `Frame preview failed: ${err}`
        temp_state.ffmpeg.message = "Frame preview failed"

        // Cleanup on error
        await cleanup_ffmpeg_files()

        temp_state.ffmpeg.is_rendering_preview = false
        temp_state.ffmpeg.progress = 0
    }
}

export async function process_subtitles() {
    if (!temp_state.ffmpeg.video_file || !temp_state.ffmpeg.srt_file) {
        temp_state.ffmpeg.error_message = "Please upload both video and SRT files"
        return
    }

    await initialize_ffmpeg_and_load_font()
    if (!temp_state.ffmpeg.ffmpeg) {
        return
    }

    temp_state.ffmpeg.message = "Processing video..."

    if (temp_state.ffmpeg.output_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.output_url)
    }

    const video_ext = temp_state.ffmpeg.video_file.name.split(".").pop() || "mp4"
    const video_name = `input.${video_ext}`
    const srt_name = "subtitles.srt"
    const output_name = "output.mp4"

    try {
        // Write input files
        temp_state.ffmpeg.message = "Loading video file"
        await write_input_files()
        console.log(`Wrote video file: ${video_name}`)
        console.log("Wrote SRT subtitles file")

        // Build force_style
        const force_style = build_force_style()

        // Execute FFmpeg command
        temp_state.ffmpeg.message = "Burning subtitles to video"
        const config = get_config(temp_state.ffmpeg.selected_quality_mode)
        const vf_filter = `subtitles=${srt_name}:fontsdir=/tmp:force_style='${force_style}'`
        await temp_state.ffmpeg.ffmpeg.exec([
            "-i",
            video_name,
            "-vf",
            vf_filter,
            "-c:v",
            "libx264",
            "-preset",
            config.preset,
            "-crf",
            config.crf,
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            config.audio_bitrate,
            "-y",
            output_name,
        ])

        // Read output
        temp_state.ffmpeg.message = "Generating output"
        const output_data = await temp_state.ffmpeg.ffmpeg.readFile(output_name)
        // @ts-expect-error
        const output_blob = new Blob([(output_data as Uint8Array).buffer], {
            type: "video/mp4",
        })
        const output_url = URL.createObjectURL(output_blob)

        // Cleanup
        await cleanup_ffmpeg_files()

        temp_state.ffmpeg.message = "Processing complete!"
        temp_state.ffmpeg.is_processing = false
        temp_state.ffmpeg.progress = 100
    } catch (err) {
        console.error("Processing failed:", err)
        temp_state.ffmpeg.error_message = `Processing failed: ${err}`
        temp_state.ffmpeg.message = "Processing failed"

        // Cleanup on error
        await cleanup_ffmpeg_files()

        // TODO Refactor tempstate on error
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

// Render ASS frame preview
export async function render_ass_frame_preview() {
    if (!temp_state.ffmpeg.video_file || !temp_state.ffmpeg.srt_file) {
        temp_state.ffmpeg.error_message = "Please upload both video and SRT files"
        return
    }

    await initialize_ffmpeg_and_load_font()
    if (!temp_state.ffmpeg.ffmpeg) {
        return
    }

    temp_state.ffmpeg.message = "Rendering ASS frame preview..."

    if (temp_state.ffmpeg.preview_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
    }

    const timestamp_seconds = parse_timestamp(temp_state.ffmpeg.preview_timestamp)
    if (timestamp_seconds < 0) {
        temp_state.ffmpeg.error_message = "Timestamp must be positive"
        temp_state.ffmpeg.is_rendering_preview = false
        return
    }

    const video_ext = temp_state.ffmpeg.video_file.name.split(".").pop() || "mp4"
    const video_name = `input.${video_ext}`
    const srt_content = await temp_state.ffmpeg.srt_file.text()
    const ass_content = generate_ass_file(srt_content)
    // const _ass_file = new File([ass_content], "subtitles.ass", { type: "text/plain" })
    const output_name = "preview.png"

    try {
        // Write input files
        await temp_state.ffmpeg.ffmpeg.writeFile(video_name, await fetchFile(temp_state.ffmpeg.video_file))
        const ass_bytes = new TextEncoder().encode(ass_content)
        await temp_state.ffmpeg.ffmpeg.writeFile("subtitles.ass", ass_bytes)

        // Build ASS filter
        const ass_filter = `ass='subtitles.ass':fontsdir=/tmp`

        // Execute FFmpeg command for frame extraction with ASS subtitles
        await temp_state.ffmpeg.ffmpeg.exec([
            "-i",
            video_name,
            "-ss",
            timestamp_seconds.toString(),
            "-avoid_negative_ts",
            "make_zero",
            "-vf",
            ass_filter,
            "-frames:v",
            "1",
            "-update",
            "1",
            "-y",
            output_name,
        ])

        // Read output
        const frame_data = await temp_state.ffmpeg.ffmpeg.readFile(output_name)
        // @ts-expect-error
        const frame_blob = new Blob([(frame_data as Uint8Array).buffer], {
            type: "image/png",
        })
        temp_state.ffmpeg.preview_url = URL.createObjectURL(frame_blob)

        // Cleanup
        await cleanup_ffmpeg_files()

        temp_state.ffmpeg.message = `ASS frame preview rendered at ${temp_state.ffmpeg.preview_timestamp}`
        temp_state.ffmpeg.is_rendering_preview = false
        temp_state.ffmpeg.progress = 100
    } catch (err) {
        console.error("ASS frame preview failed:", err)
        temp_state.ffmpeg.error_message = `ASS frame preview failed: ${err}`
        temp_state.ffmpeg.message = "ASS frame preview failed"

        // Cleanup on error
        // TODO: Remove ffmpeg files, reset temp state partially
    }
}

// Process video with ASS subtitles
export async function render_video_with_subtitles(): Promise<void> {
    temp_state.ffmpeg.processing_start_time = Date.now()
    if (!temp_state.ffmpeg.video_file || !temp_state.ffmpeg.srt_file) {
        temp_state.ffmpeg.error_message = "Please upload both video and SRT files"
        return
    }

    await initialize_ffmpeg_and_load_font()
    if (!temp_state.ffmpeg.ffmpeg) {
        return
    }

    // Set launch variables for ffmpeg
    temp_state.ffmpeg.message = "Processing video..."
    temp_state.ffmpeg.is_processing = true
    temp_state.ffmpeg.processing_start_time = Date.now()
    temp_state.ffmpeg.progress = 0
    temp_state.ffmpeg.error_message = null
    temp_state.ffmpeg.output_blob = null

    if (temp_state.ffmpeg.output_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.output_url)
    }

    const video_ext = temp_state.ffmpeg.video_file.name.split(".").pop() || "mp4"
    const video_name = `input.${video_ext}`
    const srt_content = await temp_state.ffmpeg.srt_file.text()
    const ass_content = generate_ass_file(srt_content)
    // const _ass_file = new File([ass_content], "subtitles.ass", { type: "text/plain" })
    const output_name = "output.mp4"

    try {
        // Write input files
        temp_state.ffmpeg.message = "Loading video file"
        await temp_state.ffmpeg.ffmpeg.writeFile(video_name, await fetchFile(temp_state.ffmpeg.video_file))
        console.log(`Wrote video file: ${video_name}`)

        temp_state.ffmpeg.message = "Generating ASS subtitle file"
        const ass_bytes = new TextEncoder().encode(ass_content)
        await temp_state.ffmpeg.ffmpeg.writeFile("subtitles.ass", ass_bytes)
        console.log("Wrote ASS subtitles file")

        // Build ASS filter
        const ass_filter = `ass='subtitles.ass':fontsdir=/tmp`

        // Execute FFmpeg command
        temp_state.ffmpeg.message = "Burning ASS subtitles to video"
        const config = get_config(temp_state.ffmpeg.selected_quality_mode)
        await temp_state.ffmpeg.ffmpeg.exec([
            "-i",
            video_name,
            "-vf",
            ass_filter,
            "-c:v",
            "libx264",
            "-preset",
            config.preset,
            "-crf",
            config.crf,
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            config.audio_bitrate,
            "-y",
            output_name,
        ])

        // Read output
        temp_state.ffmpeg.message = "Generating output"
        const output_data = await temp_state.ffmpeg.ffmpeg.readFile(output_name)
        // @ts-expect-error
        const output_blob = new Blob([(output_data as Uint8Array).buffer], {
            type: "video/mp4",
        })
        temp_state.ffmpeg.output_blob = output_blob
        temp_state.ffmpeg.output_url = URL.createObjectURL(output_blob)

        // Cleanup
        // TODO:
        await cleanup_ffmpeg_files()
    } catch (err) {
        console.error("ASS processing failed:", err)
        temp_state.ffmpeg.error_message = `ASS processing failed: ${err}`
        temp_state.ffmpeg.message = "ASS processing failed"

        // Cleanup on error
        await cleanup_ffmpeg_files()
    }
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

export function reset_output(set_state: (new_state: Partial<ProcessingState>) => void): void {
    set_state({
        output_url: null,
        preview_url: null,
        output_blob: null,
        error_message: null,
        progress: 0,
        message: "Ready to process",
        video_file: null,
        srt_file: null,
    })
}
