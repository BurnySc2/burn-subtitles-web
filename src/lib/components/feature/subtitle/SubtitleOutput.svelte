<script lang="ts">
import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
import { download_video, generate_ass_file } from "$lib/utils/subtitle-processing"
import {
    build_ffmpeg_command,
    download_ass_file,
    download_selected_font,
    get_selected_font_name,
} from "./SubtitleOutput.state.svelte"

const ass_content_promise = $derived.by(async () => {
    if (!temp_state.ffmpeg.srt_file) {
        return null
    }
    const srt_content = await temp_state.ffmpeg.srt_file.text()
    return generate_ass_file(srt_content)
})

const selected_font_name = $derived(get_selected_font_name(perma_state.subtitle_settings.font.index))

const ffmpeg_command = $derived(
    build_ffmpeg_command(
        temp_state.ffmpeg.video_file,
        temp_state.ffmpeg.srt_file,
        temp_state.ffmpeg.selected_quality_mode,
        perma_state.subtitle_settings.font.index,
    ),
)

let copy_button_text = $state("Copy Command")

function copy_ffmpeg_command() {
    if (ffmpeg_command) {
        navigator.clipboard.writeText(ffmpeg_command)
        copy_button_text = "Copied!"
        setTimeout(() => {
            copy_button_text = "Copy Command"
        }, 2000)
    }
}
</script>

<button
    onclick={download_selected_font}
    class="btn btn-secondary w-full mb-4"
>
    Download {selected_font_name} Font File
</button>

{#await ass_content_promise}
<!-- File content is being generated -->
{:then ass_content}
    {#if ass_content === null}
    <!-- Unable to generate file content, no srt loaded? -->
    {:else}
        <button
            onclick={() => download_ass_file(ass_content)}
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
                onclick={copy_ffmpeg_command}
                class="rounded bg-blue-200 px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-300"
            >
                {copy_button_text}
            </button>
        </div>
        <pre class="overflow-x-auto text-sm text-blue-800">{ffmpeg_command}</pre>
        <p class="mt-2 text-xs text-blue-700">
            Note: You need to download the .ass file, download the font ({selected_font_name}), have FFmpeg installed,
            and place the font file in the same directory as your video.
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
                <track kind="captions">
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
