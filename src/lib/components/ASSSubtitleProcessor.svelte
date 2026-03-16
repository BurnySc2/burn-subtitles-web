<script lang="ts">
import { temp_state } from "$lib/temporary-storage.svelte"
// See http://www.tcax.org/docs/ass-specs.htm
import { format_time_remaining, process_ass_subtitles } from "$lib/utils/subtitle-processing"
import SubtitleFramePreview from "./ui/SubtitleFramePreview.svelte"
import SubtitleOutput from "./ui/SubtitleOutput.svelte"
import SubtitleSettings from "./ui/SubtitleSettings.svelte"
import SubtitleUpload from "./ui/SubtitleUpload.svelte"
</script>

<div class="flex flex-col space-y-2">
    <div class="mx-auto text-2xl font-bold text-gray-800">Subtitle Burner</div>

    <div
        class="processor-container mx-auto max-w-6xl min-w-0 space-y-6 rounded-xl bg-white p-4 shadow-lg flex flex-col"
    >
        <SubtitleUpload />
        <SubtitleSettings />
        <SubtitleFramePreview />

        <!-- Processing Section -->
        <div class="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6">
            <h2 class="mb-6 text-xl font-bold text-gray-800">Processing</h2>

            <!-- Quality Mode -->
            <div class="mb-6">
                <label
                    for="quality-mode"
                    class="mb-3 block text-sm font-semibold text-gray-700"
                    >Quality Mode</label
                >
                <select
                    id="quality-mode"
                    bind:value={temp_state.ffmpeg.selected_quality_mode}
                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    disabled={temp_state.ffmpeg.is_processing}
                >
                    <!-- TODO Variably load modes -->
                    <option value="preview">Preview</option>
                    <option value="high">High Quality</option>
                </select>
            </div>

            <!-- Status Messages -->
            {#if temp_state.ffmpeg.error_message}
                <div class="mb-6 rounded-lg border-2 border-red-300 bg-red-50 px-5 py-4 text-red-800">
                    <div class="flex items-center">
                        <span class="mr-3">!</span>
                        <span>{temp_state.ffmpeg.error_message}</span>
                    </div>
                </div>
            {/if}

            <!-- Message -->
            <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p class="font-medium text-blue-800">{temp_state.ffmpeg.message}</p>
            </div>

            <!-- Progress Bar -->
            {#if temp_state.ffmpeg.is_processing || temp_state.ffmpeg.is_rendering_preview}
                <div class="mb-6">
                    <div class="relative pt-1">
                        <div class="mb-2 flex items-center justify-between">
                            <div>
                                <span
                                    class="inline-block rounded-full bg-teal-200 px-2 py-1 text-xs font-semibold text-teal-600 uppercase"
                                >
                                    Progress
                                </span>
                            </div>
                            <div class="text-right">
                                <span class="inline-block text-xs font-semibold text-teal-600"
                                    >{temp_state.ffmpeg.progress}%</span
                                >
                            </div>
                        </div>
                        <div class="mb-4 flex h-2 overflow-hidden rounded-full bg-gray-200 text-xs">
                            <div
                                style="width: {temp_state.ffmpeg.progress}%"
                                class="flex flex-col justify-center bg-green-500 text-center whitespace-nowrap text-white shadow-none"
                            ></div>
                        </div>
                        {#if temp_state.ffmpeg.is_processing && temp_state.ffmpeg.processing_start_time}
                            <div class="mt-2 text-center">
                                <p class="text-xs text-gray-600">
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
                onclick={process_ass_subtitles}
                disabled={temp_state.ffmpeg.is_processing ||
				!temp_state.ffmpeg.video_file ||
				!temp_state.ffmpeg.srt_file}
                class="flex w-full transform items-center justify-center rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-8 py-4 text-xl font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-green-700 hover:to-green-800 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
            >
                {#if temp_state.ffmpeg.is_processing}
                    <span class="flex items-center">
                        <div
                            class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
                        ></div>
                        Processing with ASS Subtitles...
                    </span>
                {:else}
                    Burn ASS Subtitles to Video
                {/if}
            </button>
        </div>

        <SubtitleOutput />
    </div>
</div>

<style>
.processor-container {
    max-width: none;
}
</style>
