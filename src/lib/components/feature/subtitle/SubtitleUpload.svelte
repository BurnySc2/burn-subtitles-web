<script lang="ts">
import { onDestroy } from "svelte"
// See http://www.tcax.org/docs/ass-specs.htm
import { temp_state } from "$lib/temporary-storage.svelte"
import { load_custom_font, revoke_custom_font } from "$lib/utils/custom-font"
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

async function handle_font_upload(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) {
        return
    }
    const previous = temp_state.ffmpeg.custom_font
    if (previous) {
        revoke_custom_font(previous)
    }
    const loaded = await load_custom_font(file)
    temp_state.ffmpeg.custom_font = loaded
    temp_state.ffmpeg.error_message = null
    if (temp_state.ffmpeg.preview_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
        temp_state.ffmpeg.preview_url = null
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

function remove_custom_font(): void {
    const cf = temp_state.ffmpeg.custom_font
    if (cf) {
        revoke_custom_font(cf)
        const ffmpeg = temp_state.ffmpeg.ffmpeg
        if (ffmpeg) {
            const candidates = [
                `/tmp/${cf.tmp_filename}`,
                "/tmp/__custom.ttf",
                "/tmp/__custom.otf",
                "/tmp/__custom.woff",
                "/tmp/__custom.woff2",
            ]
            for (const p of candidates) {
                ffmpeg.deleteFile(p).catch(() => {})
            }
        }
    }
    temp_state.ffmpeg.custom_font = null
    const el = document.getElementById("font-upload") as HTMLInputElement | null
    if (el) {
        el.value = ""
    }
    if (temp_state.ffmpeg.preview_url) {
        URL.revokeObjectURL(temp_state.ffmpeg.preview_url)
        temp_state.ffmpeg.preview_url = null
    }
}

onDestroy(() => {
    const cf = temp_state.ffmpeg.custom_font
    if (cf) {
        revoke_custom_font(cf)
    }
})
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

        <!-- Custom Font Upload -->
        <div class="flex-1 min-w-[200px]">
            <label
                for="font-upload"
                class="form-label-lg"
                >Custom Font <span class="form-hint font-normal">(Optional)</span>
                <span class="form-hint">(ttf/otf)</span></label
            >
            <div class="relative">
                <input
                    id="font-upload"
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2,font/*"
                    onchange={handle_font_upload}
                    aria-describedby="font-hint"
                    class="w-full rounded-lg border border-gray-300 px-2 py-2 file:rounded file:text-xs focus:border-blue-500 disabled:opacity-50"
                    disabled={temp_state.ffmpeg.is_processing}
                >
            </div>
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {#if temp_state.ffmpeg.custom_font}
                    <div
                        id="font-hint"
                        class="file-pill mt-2"
                    >
                        <span title={temp_state.ffmpeg.custom_font.file.name}
                            >{temp_state.ffmpeg.custom_font.file.name}</span
                        ><span class="text-xs text-gray-500"
                            >{format_bytes(temp_state.ffmpeg.custom_font.file.size)}</span
                        ><button
                            type="button"
                            aria-label="Remove custom font"
                            onclick={remove_custom_font}
                            class="ml-1 rounded-full p-1 hover:bg-blue-100"
                            disabled={temp_state.ffmpeg.is_processing}
                        >
                            ✕
                        </button>
                    </div>
                    {#if temp_state.ffmpeg.custom_font.tmp_filename.endsWith(".woff") || temp_state.ffmpeg.custom_font.tmp_filename.endsWith(".woff2")}
                        <p class="mt-1 text-xs text-amber-600">
                            Warning: woff/woff2 may not be supported — use ttf/otf
                        </p>
                    {/if}
                {:else}
                    <p
                        id="font-hint"
                        class="form-hint"
                    >
                        No file selected
                    </p>
                {/if}
            </div>
        </div>
    </div>
</div>
