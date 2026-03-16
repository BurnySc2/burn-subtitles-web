<script lang="ts">
import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
// See http://www.tcax.org/docs/ass-specs.htm
import {
    available_fonts,
    download_video,
    format_time_remaining,
    generate_ass_file,
    process_ass_subtitles,
    render_ass_frame_preview,
} from "$lib/utils/subtitle-processing"

let sample_text = $state("The quick brown fox jumps over the lazy dog")

function handle_video_upload(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.files?.[0]) {
        temp_state.ffmpeg.video_file = target.files[0]
        if (temp_state.ffmpeg.preview_url) {
            URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
            temp_state.ffmpeg.preview_url = null
        }
    }
}

function handle_srt_upload(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.files?.[0]) {
        temp_state.ffmpeg.srt_file = target.files[0]
        if (temp_state.ffmpeg.preview_url) {
            URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
            temp_state.ffmpeg.preview_url = null
        }
    }
}
</script>

<!-- Upload Section -->
<div class="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4">
    <h2 class="mb-4 text-lg font-bold text-gray-800">Upload Files</h2>

    <!-- Video Upload -->
    <div class="mb-4">
        <label
            for="video-upload"
            class="mb-2 block text-sm font-semibold text-gray-700"
            >Video</label
        >
        <div class="relative">
            <input
                id="video-upload"
                type="file"
                accept="video/*"
                onchange={handle_video_upload}
                class="w-full rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 transition-all duration-200 file:mr-2 file:rounded file:border-0 file:bg-green-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-green-700 hover:border-green-400 focus:ring-2 focus:ring-green-500 focus:outline-none"
                disabled={temp_state.ffmpeg.is_processing}
            >
        </div>
        {#if temp_state.ffmpeg.video_file}
            <p class="mt-1 inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                {temp_state.ffmpeg.video_file.name}
            </p>
        {/if}
    </div>

    <!-- SRT Upload -->
    <div class="mb-4">
        <label
            for="srt-upload"
            class="mb-2 block text-sm font-semibold text-gray-700"
            >SRT Subtitles</label
        >
        <div class="relative">
            <input
                id="srt-upload"
                type="file"
                accept=".srt"
                onchange={handle_srt_upload}
                class="w-full rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 transition-all duration-200 file:mr-2 file:rounded file:border-0 file:bg-green-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-green-700 hover:border-green-400 focus:ring-2 focus:ring-green-500 focus:outline-none"
                disabled={temp_state.ffmpeg.is_processing}
            >
        </div>
        {#if temp_state.ffmpeg.srt_file}
            <p class="mt-1 inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                {temp_state.ffmpeg.srt_file.name}
            </p>
        {/if}
    </div>
</div>
