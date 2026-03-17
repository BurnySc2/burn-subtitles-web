import { FFmpeg, type LogEvent } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
import { available_fonts } from "./fonts"
import { parse_timestamp } from "./format_time"
import { generate_ass_file, load_selected_font } from "./subtitle-processing"

type FfmpegPresets =
    | "ultrafast"
    | "superfast"
    | "veryfast"
    | "faster"
    | "fast"
    | "medium"
    | "slow"
    | "slower"
    | "veryslow"
export type QualityMode = "high" | "preview"

export type FfmpegConfig = {
    preset: FfmpegPresets
    crf: string
    audio_bitrate: string
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

export async function load_ffmpeg() {
    // Already loaded?
    if (temp_state.ffmpeg.ffmpeg) {
        return
    }

    const new_ffmpeg = new FFmpeg()

    new_ffmpeg.on("log", ({ message: msg }: LogEvent) => {
        console.log("FFmpeg log:", msg)
        // Don't update UI message with technical logs
    })

    // @ts-expect-error
    new_ffmpeg.on("progress", ({ progress }: ProgressEvent) => {
        temp_state.ffmpeg.progress = Math.round(progress * 10000) / 100
    })

    try {
        temp_state.ffmpeg.message = "Loading FFmpeg core"
        const base_url = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm"
        // const base_url = page.url.origin
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

export async function render_prepare(): Promise<boolean> {
    // Sanity check
    if (!temp_state.ffmpeg.video_file || !temp_state.ffmpeg.srt_file) {
        temp_state.ffmpeg.error_message = "Please upload both video and SRT files"
        return false
    }

    // Load ffmpeg
    await load_ffmpeg()
    if (!temp_state.ffmpeg.ffmpeg) {
        return false
    }
    // Reset input and output
    await cleanup_ffmpeg_files()

    // Load font
    const font_success = await load_selected_font()
    if (!font_success) {
        return false
    }

    // Write input files
    // Write video file
    await temp_state.ffmpeg.ffmpeg.writeFile(
        temp_state.ffmpeg.video_file.name,
        await fetchFile(temp_state.ffmpeg.video_file),
    )
    // Generate and write .ass file
    const srt_content = await temp_state.ffmpeg.srt_file.text()
    const ass_content = generate_ass_file(srt_content)
    const ass_bytes = new TextEncoder().encode(ass_content)
    await temp_state.ffmpeg.ffmpeg.writeFile("subtitles.ass", ass_bytes)

    // Reset state
    temp_state.ffmpeg.progress = 0
    temp_state.ffmpeg.error_message = null
    temp_state.ffmpeg.output_blob = null

    return true
}

// Render frame preview
export async function render_ass_frame_preview() {
    const is_prepared = await render_prepare()
    if (!is_prepared) {
        return
    }
    if (!temp_state.ffmpeg.video_file || !temp_state.ffmpeg.srt_file || !temp_state.ffmpeg.ffmpeg) {
        return
    }

    temp_state.ffmpeg.message = "Rendering frame preview..."

    if (temp_state.ffmpeg.preview_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
    }

    const timestamp_seconds = parse_timestamp(temp_state.ffmpeg.preview_timestamp)
    if (timestamp_seconds < 0) {
        temp_state.ffmpeg.error_message = "Timestamp must be positive"
        temp_state.ffmpeg.is_rendering_preview = false
        return
    }

    const output_name = "preview.png"
    // Build ASS filter
    const ass_filter = `ass='subtitles.ass':fontsdir=/tmp`

    try {
        // Execute FFmpeg command for frame extraction with ASS subtitles
        await temp_state.ffmpeg.ffmpeg.exec([
            "-i",
            temp_state.ffmpeg.video_file.name,
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
        await cleanup_ffmpeg_files(false)

        temp_state.ffmpeg.message = `Frame preview rendered at ${temp_state.ffmpeg.preview_timestamp}`
        temp_state.ffmpeg.is_rendering_preview = false
        temp_state.ffmpeg.progress = 100
    } catch (err) {
        console.error("Frame preview failed:", err)
        temp_state.ffmpeg.error_message = `Frame preview failed: ${err}`
        temp_state.ffmpeg.message = "Frame preview failed"

        // Cleanup on error
        await cleanup_ffmpeg_files()
    }
}

// Process video with ASS subtitles
export async function render_video_with_subtitles() {
    const is_prepared = await render_prepare()
    if (!is_prepared) {
        return
    }
    if (!temp_state.ffmpeg.video_file || !temp_state.ffmpeg.srt_file || !temp_state.ffmpeg.ffmpeg) {
        return
    }

    // Set launch variables for ffmpeg
    temp_state.ffmpeg.message = "Processing video..."
    temp_state.ffmpeg.is_processing = true
    temp_state.ffmpeg.processing_start_time = Date.now()

    if (temp_state.ffmpeg.output_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.output_url)
    }

    const output_name = "output.mp4"

    try {
        // Build ASS filter
        const ass_filter = `ass='subtitles.ass':fontsdir=/tmp`
        // Execute FFmpeg command
        temp_state.ffmpeg.message = "Burning subtitles to video"
        const config = get_config(temp_state.ffmpeg.selected_quality_mode)
        await temp_state.ffmpeg.ffmpeg.exec([
            "-i",
            temp_state.ffmpeg.video_file.name,
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
        await cleanup_ffmpeg_files(false)
        temp_state.ffmpeg.is_processing = false
        temp_state.ffmpeg.message = "Video successfully created"
    } catch (err) {
        temp_state.ffmpeg.error_message = `Processing failed: ${err}`
        temp_state.ffmpeg.message = "Processing failed"

        // Cleanup on error
        await cleanup_ffmpeg_files(true)
    }
}

// Helper function to clean up FFmpeg files
async function cleanup_ffmpeg_files(delete_output: boolean = true) {
    if (!temp_state.ffmpeg.ffmpeg) {
        return
    }
    // Delete input files
    if (temp_state.ffmpeg.video_file) {
        await temp_state.ffmpeg.ffmpeg.deleteFile(temp_state.ffmpeg.video_file.name).catch(() => {})
    }
    if (temp_state.ffmpeg.srt_file) {
        await temp_state.ffmpeg.ffmpeg.deleteFile(temp_state.ffmpeg.srt_file.name).catch(() => {})
    }
    // Delete font file
    const selected_font = available_fonts[perma_state.subtitle_settings.font.index]
    await temp_state.ffmpeg.ffmpeg.deleteFile(`/tmp/${selected_font.filename}`).catch(() => {})

    // Delete output files
    if (delete_output) {
        await temp_state.ffmpeg.ffmpeg.deleteFile("output.mp4").catch(() => {})
        await temp_state.ffmpeg.ffmpeg.deleteFile("preview.png").catch(() => {})
    }
}
