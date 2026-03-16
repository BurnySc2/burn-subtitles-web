<script lang="ts">
import { perma_state } from "$lib/persistent-storage.svelte"
import { temp_state } from "$lib/temporary-storage.svelte"
import { available_fonts } from "$lib/utils/fonts"
import { render_ass_frame_preview } from "$lib/utils/video-processing"
// See http://www.tcax.org/docs/ass-specs.htm
import FontPreview from "../FontPreview.svelte"

let sample_text = $state("The quick brown fox jumps over the lazy dog")
</script>

<!-- Font Preview -->
<div class="rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-6">
    <h3 class="mb-4 text-lg font-bold text-gray-800">Font Preview</h3>
    <div class="rounded-lg bg-white p-2 shadow-inner">
        <div class="mx-auto flex w-full items-center justify-center space-x-4">
            <FontPreview
                font_name={available_fonts[perma_state.subtitle_settings.font.index]
						.font_family}
                font_size={perma_state.subtitle_settings.font.size}
                {sample_text}
                font_weight={available_fonts[perma_state.subtitle_settings.font.index]
						.font_weight}
            />
        </div>
    </div>
</div>

<!-- Frame Preview Section -->
{#if temp_state.ffmpeg.video_file && temp_state.ffmpeg.srt_file}
    <div class="rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-6">
        <h2 class="mb-4 text-xl font-bold text-gray-800">Frame Preview</h2>
        <!-- Preview Timestamp Input -->
        <div class="mb-6">
            <label
                for="preview-timestamp"
                class="mb-2 block text-sm font-semibold text-gray-700"
                >Preview Timestamp</label
            >
            <div class="flex items-center space-x-3">
                <input
                    id="preview-timestamp"
                    type="text"
                    bind:value={temp_state.ffmpeg.preview_timestamp}
                    placeholder="00:00:00"
                    class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    disabled={temp_state.ffmpeg.is_processing ||
							temp_state.ffmpeg.is_rendering_preview}
                >
                <button
                    onclick={render_ass_frame_preview}
                    disabled={temp_state.ffmpeg.is_processing ||
							temp_state.ffmpeg.is_rendering_preview}
                    class="transform rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
                >
                    {#if temp_state.ffmpeg.is_rendering_preview}
                        <span class="flex items-center justify-center">
                            Rendering...
                            <div
                                class="ml-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
                            ></div>
                        </span>
                    {:else}
                        Render Preview
                    {/if}
                </button>
            </div>
        </div>
        {#if temp_state.ffmpeg.preview_url}
            <div class="text-center">
                <div class="mx-auto max-w-4xl rounded-lg bg-black p-1">
                    <img
                        src={temp_state.ffmpeg.preview_url}
                        alt="ASS frame preview with subtitles"
                        class="w-full rounded-lg"
                        style="max-height: 500px;"
                    >
                </div>
                <p class="mt-3 inline-block rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                    Preview at {temp_state.ffmpeg.preview_timestamp}
                </p>
            </div>
        {:else}
            <div class="rounded-lg bg-gray-50 py-8 text-center">
                <p class="mb-2 text-lg text-gray-500">No preview yet</p>
                <p class="text-sm text-gray-400">
                    Click "Render Preview" to see how your styled subtitles will look on the video frame.
                </p>
            </div>
        {/if}
    </div>
{/if}
