import { FFmpeg, type LogEvent } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import { temp_state } from "$lib/temporary-storage.svelte"
import { parse_clip_timestamp } from "./format_time"

export async function load_ffmpeg_for_clip(): Promise<FFmpeg | null> {
    if (temp_state.ffmpeg.ffmpeg) {
        return temp_state.ffmpeg.ffmpeg
    }

    const new_ffmpeg = new FFmpeg()

    new_ffmpeg.on("log", ({ message: msg }: LogEvent) => {
        console.log("FFmpeg log:", msg)
    })

    // @ts-expect-error
    new_ffmpeg.on("progress", ({ progress }: ProgressEvent) => {
        temp_state.clip.progress = Math.round(progress * 10000) / 100
    })

    try {
        temp_state.clip.message = "Loading FFmpeg core"
        const base_url = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm"
        await new_ffmpeg.load({
            coreURL: await toBlobURL(`${base_url}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${base_url}/ffmpeg-core.wasm`, "application/wasm"),
        })

        temp_state.clip.message = "FFmpeg loaded successfully"
        temp_state.ffmpeg.ffmpeg = new_ffmpeg
        return new_ffmpeg
    } catch (err) {
        console.error("Failed to load FFmpeg:", err)
        temp_state.clip.error_message = "Failed to initialize FFmpeg"
        temp_state.clip.message = null
        return null
    }
}

export async function trim_video(): Promise<boolean> {
    // Validate inputs
    if (!temp_state.clip.video_file) {
        temp_state.clip.error_message = "Please upload a video file"
        return false
    }

    let startSeconds: number
    let endSeconds: number

    try {
        startSeconds = parse_clip_timestamp(temp_state.clip.start_time)
        endSeconds = parse_clip_timestamp(temp_state.clip.end_time)
    } catch {
        temp_state.clip.error_message = "Invalid timestamp format. Use mm:ss.mmm"
        return false
    }

    if (startSeconds < 0) {
        temp_state.clip.error_message = "Start time must be positive"
        return false
    }

    if (endSeconds <= startSeconds) {
        temp_state.clip.error_message = "End time must be greater than start time"
        return false
    }

    // Load FFmpeg
    const ffmpeg = await load_ffmpeg_for_clip()
    if (!ffmpeg) {
        return false
    }

    // Reset state
    temp_state.clip.progress = 0
    temp_state.clip.error_message = null
    temp_state.clip.message = "Processing video..."
    temp_state.clip.output_blob = null

    if (temp_state.clip.output_url) {
        URL.revokeObjectURL(temp_state.clip.output_url)
        temp_state.clip.output_url = null
    }

    const duration = endSeconds - startSeconds
    const input_name = "input" + get_file_extension(temp_state.clip.video_file.name)
    const output_name = "output" + get_file_extension(temp_state.clip.video_file.name)

    try {
        // Write input file
        await ffmpeg.writeFile(input_name, await fetchFile(temp_state.clip.video_file))

        // Execute FFmpeg command for trimming
        // Using input seeking (-ss before -i) for faster processing
        await ffmpeg.exec([
            "-ss",
            startSeconds.toString(),
            "-i",
            input_name,
            "-t",
            duration.toString(),
            "-c",
            "copy",
            "-y",
            output_name,
        ])

        // Read output
        const data = await ffmpeg.readFile(output_name)
        // @ts-expect-error
        const blob = new Blob([(data as Uint8Array).buffer], {
            type: temp_state.clip.video_file.type || "video/mp4",
        })

        temp_state.clip.output_blob = blob
        temp_state.clip.output_url = URL.createObjectURL(blob)
        temp_state.clip.progress = 100
        temp_state.clip.message = "Clip extracted successfully!"

        // Cleanup
        await ffmpeg.deleteFile(input_name)
        await ffmpeg.deleteFile(output_name)

        return true
    } catch (err) {
        console.error("Video trimming failed:", err)
        temp_state.clip.error_message = `Failed to extract clip: ${err}`
        temp_state.clip.message = null

        // Cleanup on error
        try {
            await ffmpeg.deleteFile(input_name)
        } catch {
            /* ignore */
        }
        try {
            await ffmpeg.deleteFile(output_name)
        } catch {
            /* ignore */
        }

        return false
    }
}

function get_file_extension(filename: string): string {
    const match = filename.match(/\.[^.]+$/)
    return match ? match[0] : ".mp4"
}
