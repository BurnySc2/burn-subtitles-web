<script lang="ts">
import { temp_state } from "$lib/temporary-storage.svelte"
import { format_time_remaining } from "$lib/utils/format_time"
// See http://www.tcax.org/docs/ass-specs.htm
import { render_video_with_subtitles } from "$lib/utils/video-processing"
import SubtitleFramePreview from "./SubtitleFramePreview.svelte"
import SubtitleOutput from "./SubtitleOutput.svelte"
import SubtitleSettings from "./SubtitleSettings.svelte"
import SubtitleUpload from "./SubtitleUpload.svelte"

export function reset_output(): void {
    temp_state.ffmpeg.output_blob = null
    temp_state.ffmpeg.output_url = null
    temp_state.ffmpeg.preview_url = null
    temp_state.ffmpeg.error_message = null
    temp_state.ffmpeg.is_processing = false
    temp_state.ffmpeg.message = "Ready to render"
    temp_state.ffmpeg.progress = 0
    temp_state.ffmpeg.video_file = null
    temp_state.ffmpeg.srt_file = null
}
</script>

<div class="flex flex-col space-y-2">
    <div class="mx-auto text-2xl font-bold">Subtitles Burner</div>
    <div class="space-y-6 flex flex-col">
        <SubtitleUpload />
        <SubtitleSettings />
        <SubtitleFramePreview />

        <!-- Render Section -->
        <div class="rounded-lg border p-6">
            <h2 class="mb-6 text-xl font-bold">Render Section</h2>

            <!-- Quality Mode -->
            <div class="mb-6">
                <label
                    for="quality-mode"
                    class="mb-3 block text-sm font-semibold"
                    >Quality Mode</label
                >
                <select
                    id="quality-mode"
                    bind:value={temp_state.ffmpeg.selected_quality_mode}
                    class="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:outline-none"
                    disabled={temp_state.ffmpeg.is_processing}
                >
                    <!-- TODO Variably load modes -->
                    <option value="preview">Preview</option>
                    <option value="high">High Quality</option>
                </select>
            </div>

            <!-- Status Messages -->
            {#if temp_state.ffmpeg.error_message}
                <div class="mb-6 rounded-lg border border-red-500 bg-red-50 px-5 py-4">
                    <div class="flex items-center text-red-700">
                        <span class="mr-3">!</span>
                        <span>{temp_state.ffmpeg.error_message}</span>
                    </div>
                </div>
            {/if}

            <!-- Message -->
            <div class="mb-6 rounded-lg border p-4">
                <p class="font-medium">{temp_state.ffmpeg.message}</p>
            </div>

            <!-- Progress Bar -->
            {#if temp_state.ffmpeg.is_processing || temp_state.ffmpeg.is_rendering_preview}
                <div class="mb-6">
                    <div class="relative pt-1">
                        <div class="mb-2 flex items-center justify-between">
                            <div>
                                <span class="inline-block rounded-full px-2 py-1 text-xs font-semibold uppercase">
                                    Progress
                                </span>
                            </div>
                            <div class="text-right">
                                <span class="inline-block text-xs font-semibold">{temp_state.ffmpeg.progress}%</span>
                            </div>
                        </div>
                        <div class="mb-4 flex h-2 overflow-hidden rounded-full text-xs">
                            <div
                                class="flex flex-col justify-center text-center whitespace-nowrap bg-green-500 transition-all duration-300"
                                style="width: {temp_state.ffmpeg.progress}%"
                            ></div>
                        </div>
                        {#if temp_state.ffmpeg.is_processing && temp_state.ffmpeg.processing_start_time}
                            <div class="mt-2 text-center">
                                <p class="text-xs">
                                    {format_time_remaining(
									temp_state.ffmpeg.processing_start_time,
									temp_state.ffmpeg.progress,
								)}
                                </p>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- Process Button -->
            <button
                onclick={render_video_with_subtitles}
                disabled={temp_state.ffmpeg.is_processing ||
				!temp_state.ffmpeg.video_file ||
				!temp_state.ffmpeg.srt_file}
                class="flex w-full transform items-center justify-center rounded-lg px-8 py-4 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {#if temp_state.ffmpeg.is_processing}
                    <span class="flex items-center">
                        <div class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"></div>
                        Rendering video with subtitles...
                    </span>
                {:else}
                    Render Subtitles into Video
                {/if}
            </button>
        </div>

        <SubtitleOutput />
    </div>
</div>
