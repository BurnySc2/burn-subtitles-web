<script lang="ts">
// See http://www.tcax.org/docs/ass-specs.htm
import { temp_state } from "$lib/temporary-storage.svelte"

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
<div class="rounded-lg border p-3">
    <h2 class="mb-3 text-lg font-bold ">Upload Files</h2>
    <div class="flex flex-wrap gap-3">
        <!-- Video Upload -->
        <div class="flex-1 min-w-[200px]">
            <label
                for="video-upload"
                class="mb-1 block font-semibold"
                >Video</label
            >
            <div class="relative">
                <input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    onchange={handle_video_upload}
                    class="w-full rounded-lg px-2 py-2 file:rounded file:text-xs"
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>
        </div>

        <!-- SRT Upload -->
        <div class="flex-1 min-w-[200px]">
            <label
                for="srt-upload"
                class="mb-1 block font-semibold"
                >Subtitles File</label
            >
            <div class="relative">
                <input
                    id="srt-upload"
                    type="file"
                    accept=".srt"
                    onchange={handle_srt_upload}
                    class="w-full rounded-lg px-2 py-2 file:rounded file:text-xs"
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>
        </div>
    </div>
</div>
