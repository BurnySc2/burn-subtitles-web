<script lang="ts">
// See http://www.tcax.org/docs/ass-specs.htm
import { temp_state } from "$lib/temporary-storage.svelte"
import { get_video_dimensions } from "$lib/utils/video-metadata"

function handle_video_upload(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.files?.[0]) {
        const file = target.files[0]
        temp_state.ffmpeg.video_file = file
        temp_state.ffmpeg.video_width = null
        temp_state.ffmpeg.video_height = null
        if (temp_state.ffmpeg.preview_url) {
            URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
            temp_state.ffmpeg.preview_url = null
        }
        get_video_dimensions(file).then((dimensions) => {
            // Ignore stale results: a newer upload may have replaced the file
            // while this probe was still in flight.
            if (dimensions && temp_state.ffmpeg.video_file === file) {
                temp_state.ffmpeg.video_width = dimensions.width
                temp_state.ffmpeg.video_height = dimensions.height
            }
        })
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

function format_bytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`
    }
    if (bytes < 1_048_576) {
        return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${(bytes / 1_048_576).toFixed(1)} MB`
}

function remove_video(): void {
    if (temp_state.ffmpeg.preview_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
        temp_state.ffmpeg.preview_url = null
    }
    temp_state.ffmpeg.video_file = null
    temp_state.ffmpeg.video_width = null
    temp_state.ffmpeg.video_height = null
    const el = document.getElementById("video-upload") as HTMLInputElement | null
    if (el) {
        el.value = ""
    }
}

function remove_srt(): void {
    if (temp_state.ffmpeg.preview_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
        temp_state.ffmpeg.preview_url = null
    }
    temp_state.ffmpeg.srt_file = null
    const el = document.getElementById("srt-upload") as HTMLInputElement | null
    if (el) {
        el.value = ""
    }
}
</script>

<!-- Upload Section -->
<div class="section">
    <h2 class="section-title">Upload Files</h2>
    <div class="flex flex-wrap gap-3">
        <!-- Video Upload -->
        <div class="flex-1 min-w-[200px]">
            <label
                for="video-upload"
                class="form-label-lg"
                >Video <span class="form-hint">(max 2 GB)</span></label
            >
            <div class="relative">
                <input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    onchange={handle_video_upload}
                    aria-describedby="video-hint"
                    class="w-full rounded-lg border border-gray-300 px-2 py-2 file:rounded file:text-xs focus:border-blue-500 disabled:opacity-50"
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {#if temp_state.ffmpeg.video_file}
                    <div
                        id="video-hint"
                        class="file-pill mt-2"
                    >
                        <span title={temp_state.ffmpeg.video_file.name}>{temp_state.ffmpeg.video_file.name}</span
                        ><span class="text-xs text-gray-500">{format_bytes(temp_state.ffmpeg.video_file.size)}</span
                        ><button
                            type="button"
                            aria-label="Remove video"
                            onclick={remove_video}
                            class="ml-1 rounded-full p-1 hover:bg-blue-100"
                            disabled={temp_state.ffmpeg.is_processing}
                        >
                            ✕
                        </button>
                    </div>
                {:else}
                    <p
                        id="video-hint"
                        class="form-hint"
                    >
                        No file selected
                    </p>
                {/if}
            </div>
        </div>

        <!-- SRT Upload -->
        <div class="flex-1 min-w-[200px]">
            <label
                for="srt-upload"
                class="form-label-lg"
                >Subtitles File</label
            >
            <div class="relative">
                <input
                    id="srt-upload"
                    type="file"
                    accept=".srt"
                    onchange={handle_srt_upload}
                    aria-describedby="srt-hint"
                    class="w-full rounded-lg border border-gray-300 px-2 py-2 file:rounded file:text-xs focus:border-blue-500 disabled:opacity-50"
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {#if temp_state.ffmpeg.srt_file}
                    <div
                        id="srt-hint"
                        class="file-pill mt-2"
                    >
                        <span title={temp_state.ffmpeg.srt_file.name}>{temp_state.ffmpeg.srt_file.name}</span
                        ><span class="text-xs text-gray-500">{format_bytes(temp_state.ffmpeg.srt_file.size)}</span
                        ><button
                            type="button"
                            aria-label="Remove subtitles"
                            onclick={remove_srt}
                            class="ml-1 rounded-full p-1 hover:bg-blue-100"
                            disabled={temp_state.ffmpeg.is_processing}
                        >
                            ✕
                        </button>
                    </div>
                {:else}
                    <p
                        id="srt-hint"
                        class="form-hint"
                    >
                        No file selected
                    </p>
                {/if}
            </div>
        </div>
    </div>
</div>
