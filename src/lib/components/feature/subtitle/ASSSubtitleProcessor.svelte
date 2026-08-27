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
    temp_state.ffmpeg.message = "Status: Ready to render"
    temp_state.ffmpeg.progress = 0
    temp_state.ffmpeg.video_file = null
    temp_state.ffmpeg.srt_file = null
}

let cta_reason = $derived(
    temp_state.ffmpeg.is_processing
        ? "Rendering in progress…"
        : !temp_state.ffmpeg.video_file && !temp_state.ffmpeg.srt_file
          ? "Upload a video and subtitles file to enable rendering."
          : !temp_state.ffmpeg.video_file
            ? "Add a video file to enable rendering."
            : !temp_state.ffmpeg.srt_file
              ? "Add a subtitles (.srt) file to enable rendering."
              : null,
)
</script>

<div class="flex w-full flex-col gap-6 sm:gap-8">
    <h1 class="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Subtitles Burner</h1>
    <div class="flex flex-col gap-6 lg:mx-8 md:mx-4 sm:gap-8">
        <SubtitleUpload />
        <SubtitleSettings />
        <SubtitleFramePreview />

        <!-- Render Section -->
        <div class="section">
            <h2 class="section-title">Render Section</h2>

            <!-- Quality Mode -->
            <div class="mb-6">
                <label
                    for="quality-mode"
                    class="form-label"
                    >Quality Mode</label
                >
                <select
                    id="quality-mode"
                    bind:value={temp_state.ffmpeg.selected_quality_mode}
                    disabled={temp_state.ffmpeg.is_processing}
                >
                    <!-- TODO Variably load modes -->
                    <option value="preview">Preview</option>
                    <option value="high">High Quality</option>
                </select>
            </div>

            <!-- Status Messages -->
            {#if temp_state.ffmpeg.error_message}
                <div
                    class="mb-6 rounded-lg border border-red-500 bg-red-50 px-5 py-4"
                    role="alert"
                    aria-live="assertive"
                >
                    <div class="flex items-center text-red-700">
                        <span
                            class="mr-3"
                            aria-hidden="true"
                            >!</span
                        >
                        <span>{temp_state.ffmpeg.error_message}</span>
                    </div>
                </div>
            {/if}

            <!-- Message -->
            <div class="mb-6 rounded-lg border p-4">
                <p
                    class="font-medium"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {temp_state.ffmpeg.message}
                </p>
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
                                role="progressbar"
                                aria-valuenow={temp_state.ffmpeg.progress}
                                aria-valuemin="0"
                                aria-valuemax="100"
                                aria-label="Rendering progress"
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
                class="btn btn-primary btn-lg w-full"
                aria-describedby={cta_reason ? "cta-helper" : undefined}
            >
                {#if temp_state.ffmpeg.is_processing}
                    <span class="flex items-center">
                        <div
                            class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                            aria-hidden="true"
                        ></div>
                        Rendering video with subtitles...
                    </span>
                {:else}
                    Render Subtitles into Video
                {/if}
            </button>
            {#if cta_reason}
                <p
                    id="cta-helper"
                    class="form-hint mt-2 text-center"
                    aria-live="polite"
                >
                    {cta_reason}
                </p>
            {/if}
        </div>

        <SubtitleOutput />
    </div>
</div>
