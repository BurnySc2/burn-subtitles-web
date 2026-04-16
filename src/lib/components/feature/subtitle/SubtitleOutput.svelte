<script lang="ts">
// See http://www.tcax.org/docs/ass-specs.htm
import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
import { available_fonts } from "$lib/utils/fonts"
import { download_video, generate_ass_file } from "$lib/utils/subtitle-processing"
import { get_config } from "$lib/utils/video-processing"

const ass_content_promise = $derived.by(async () => {
    if (!temp_state.ffmpeg.srt_file) {
        return null
    }
    const srt_content = await temp_state.ffmpeg.srt_file.text()
    const ass_content = generate_ass_file(srt_content)
    return ass_content
})

async function download_ass_file_wrapper() {
    if (!temp_state.ffmpeg.srt_file) {
        temp_state.ffmpeg.error_message = "Please upload an SRT file first"
        return
    }
    const ass_content = await ass_content_promise
    if (ass_content === null) {
        return
    }
    const blob = new Blob([ass_content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "styled_subtitles.ass"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

const ffmpeg_command = $derived.by(() => {
    if (!temp_state.ffmpeg.video_file || !temp_state.ffmpeg.srt_file) {
        return null
    }
    const selected_font = available_fonts[perma_state.subtitle_settings.font.index]
    const config = get_config(temp_state.ffmpeg.selected_quality_mode)
    const video_name = temp_state.ffmpeg.video_file.name
    const output_name = `output_${video_name.replace(/\.[^/.]+$/, "")}.mp4`
    // TODO: Add download selected font
    return `ffmpeg -i input.mp4 -vf "ass=subtitles.ass:fontsdir=/path/to/fonts" -c:v libx264 -preset ${config.preset} -crf ${config.crf} -pix_fmt yuv420p -c:a aac -b:a ${config.audio_bitrate} -y output.mp4`
})

let copy_button_text = $state("Copy Command")
</script>

{#await ass_content_promise}
<!-- File content is being generated -->
{:then ass_content}
    {#if ass_content === null}
    <!-- Unable to generate file content, no srt loaded? -->
    {:else}
        <button
            onclick={download_ass_file_wrapper}
            class="btn btn-secondary w-full mb-4"
        >
            Download .ass File
        </button>
    {/if}
{/await}

<!-- FFmpeg Command for Local Run -->
{#if ffmpeg_command}
    <div class="rounded-lg border border-blue-300 bg-blue-50 p-4">
        <div class="mb-2 flex items-center justify-between">
            <span class="font-medium text-blue-900">Run locally with FFmpeg</span>
            <button
                onclick={() => {
                    navigator.clipboard.writeText(ffmpeg_command)
                    copy_button_text = "Copied!"
                    setTimeout(() => { copy_button_text = "Copy Command" }, 2000)
                }}
                class="rounded bg-blue-200 px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-300"
            >
                {copy_button_text}
            </button>
        </div>
        <pre class="overflow-x-auto text-sm text-blue-800">{ffmpeg_command}</pre>
        <p class="mt-2 text-xs text-blue-700">
            Note: You need to generate the .ass file (download above), have FFmpeg installed, and place your font file
            at the specified path.
        </p>
    </div>
{/if}

<!-- Output Section -->
{#if temp_state.ffmpeg.output_url}
    <div class="section space-y-6">
        <div class="overflow-hidden rounded-xl">
            <video
                src={temp_state.ffmpeg.output_url}
                controls
                class="mx-auto w-full max-w-4xl"
            >
                Your browser does not support the video tag.
            </video>
        </div>

        <div class="flex flex-col gap-4 border-t pt-4 sm:flex-row">
            <button
                onclick={download_video}
                class="btn btn-primary flex-1"
            >
                Download Video
            </button>
        </div>
    </div>
{/if}
