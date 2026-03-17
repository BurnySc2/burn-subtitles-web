<script lang="ts">
import { temp_state } from "$lib/temporary-storage.svelte"
// See http://www.tcax.org/docs/ass-specs.htm
import { download_video, generate_ass_file } from "$lib/utils/subtitle-processing"

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
</script>

{#await ass_content_promise}
<!-- File content is being generated -->
{:then ass_content}
    {#if ass_content === null}
    <!-- Unable to generate file content, no srt loaded? -->
    {:else}
        <button
            onclick={download_ass_file_wrapper}
            class="flex flex-1 transform items-center justify-center rounded-lg px-8 py-4 text-lg font-bold"
        >
            Download .ass File
        </button>
    {/if}
{/await}

<!-- Output Section -->
{#if temp_state.ffmpeg.output_url}
    <div class="space-y-6 rounded-lg border p-6">
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
                class="flex flex-1 transform items-center justify-center rounded-lg px-8 py-4 text-lg font-bold"
            >
                Download Video
            </button>
        </div>
    </div>
{/if}
