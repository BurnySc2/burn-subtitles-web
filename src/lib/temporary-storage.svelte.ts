import type { FFmpeg } from "@ffmpeg/ffmpeg"

// Types
export type TempState = {
    ffmpeg: {
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
        selected_quality_mode: "preview"
        preview_timestamp: "00:00:05"
        video_file: File | null
        srt_file: File | null
    }
    extract_srt: {
        file: File | null
        ods_data: string[][][] | null
        selected_sheet: number
        selected_column: number
        selected_start_row: number
        selected_end_row: number
    }
    clip: {
        video_file: File | null
        video_url: string | null
        start_time: string
        end_time: string
        output_blob: Blob | null
        output_url: string | null
        is_processing: boolean
        progress: number
        message: string | null
        error_message: string | null
    }
}

export const temp_state: TempState = $state({
    ffmpeg: {
        ffmpeg: null,
        is_processing: false,
        is_rendering_preview: false,
        progress: 0,
        output_blob: null,
        output_url: null,
        preview_url: null,
        message: "Status: Ready to render",
        error_message: null,
        processing_start_time: null,
        estimated_total_duration: 0,
        selected_quality_mode: "preview",
        preview_timestamp: "00:00:05",
        video_file: null,
        srt_file: null,
    },
    extract_srt: {
        file: null,
        ods_data: null,
        selected_sheet: 1,
        selected_column: 1,
        selected_start_row: 1,
        selected_end_row: 999,
    },
    clip: {
        video_file: null,
        video_url: null,
        start_time: "00:00.000",
        end_time: "00:00.000",
        output_blob: null,
        output_url: null,
        is_processing: false,
        progress: 0,
        message: null,
        error_message: null,
    },
})
