<script lang="ts">
import { temp_state } from "$lib/temporary-storage.svelte"
// See http://www.tcax.org/docs/ass-specs.htm
import {
    download_video,
    format_time_remaining,
    generate_ass_file,
    process_ass_subtitles,
} from "$lib/utils/subtitle-processing"

async function download_ass_file_wrapper() {
    if (!temp_state.ffmpeg.srt_file) {
        temp_state.ffmpeg.error_message = "Please upload an SRT file first"
        return
    }

    try {
        const srt_content = await temp_state.ffmpeg.srt_file.text()
        const ass_content = generate_ass_file(srt_content)

        const blob = new Blob([ass_content], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `styled-subtitles-${temp_state.ffmpeg.video_file?.name.replace(/\.[^/.]+$/, "") || "video"}.ass`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        temp_state.ffmpeg.message = "ASS file downloaded successfully"
    } catch (error) {
        temp_state.ffmpeg.error_message = `Failed to download ASS file: ${error}`
    }
}
</script>

<!-- Output Section -->
{#if temp_state.ffmpeg.output_url}
    <div class="space-y-6 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6">
        <h2 class="text-2xl font-bold text-gray-800">ASS Output Ready!</h2>
        <div class="overflow-hidden rounded-xl bg-black shadow-2xl">
            <video
                src={temp_state.ffmpeg.output_url}
                controls
                class="mx-auto w-full max-w-4xl"
            >
                Your browser does not support the video tag.
            </video>
        </div>
        <div class="flex flex-col gap-4 border-t border-emerald-200 pt-4 sm:flex-row">
            <button
                onclick={download_ass_file_wrapper}
                class="flex flex-1 transform items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-purple-700 hover:to-purple-800 hover:shadow-xl"
            >
                Download ASS File
            </button>
            <button
                onclick={download_video}
                class="flex flex-1 transform items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl"
            >
                Download Video
            </button>
            <button
                onclick={() => "TODO: reset_output_wrapper"}
                class="flex flex-1 transform items-center justify-center rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-gray-600 hover:to-gray-700 hover:shadow-xl"
            >
                Start Over
            </button>
        </div>
    </div>
{:else if temp_state.ffmpeg.video_file && temp_state.ffmpeg.srt_file && !temp_state.ffmpeg.is_processing}
    <div class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center">
        <h3 class="mb-2 text-lg font-semibold text-gray-700">Ready to Process!</h3>
        <p class="text-gray-500">
            Configure your ASS subtitle styling above and click "Burn ASS Subtitles to Video" to create your styled
            subtitled video.
        </p>
    </div>
{:else}
    <div class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center">
        <h3 class="mb-2 text-lg font-semibold text-gray-700">Get Started</h3>
        <p class="mb-4 text-gray-500">
            Upload your video file and SRT subtitle file to begin creating styled ASS subtitled videos.
        </p>
        <div class="flex justify-center space-x-4 text-sm text-gray-400">
            <span>Video</span>
            <span class="text-gray-300">→</span>
            <span>SRT → ASS</span>
            <span class="text-gray-300">→</span>
            <span>Output</span>
        </div>
    </div>
{/if}
