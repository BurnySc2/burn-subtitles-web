<script lang="ts">
import { temp_state } from "$lib/temporary-storage.svelte"
import { trim_video } from "$lib/utils/clip-processing"

function handle_video_upload(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
        return
    }

    // Clean up previous video URL
    if (temp_state.clip.video_url) {
        URL.revokeObjectURL(temp_state.clip.video_url)
    }

    temp_state.clip.video_file = file
    temp_state.clip.video_url = URL.createObjectURL(file)
    temp_state.clip.output_blob = null
    if (temp_state.clip.output_url) {
        URL.revokeObjectURL(temp_state.clip.output_url)
        temp_state.clip.output_url = null
    }
    temp_state.clip.message = null
    temp_state.clip.error_message = null
}

async function handle_extract() {
    temp_state.clip.is_processing = true
    await trim_video()
    temp_state.clip.is_processing = false
}

function handle_download() {
    if (!temp_state.clip.output_blob || !temp_state.clip.video_file || !temp_state.clip.output_url) {
        return
    }

    const ext = temp_state.clip.video_file.name.split(".").pop() || "mp4"
    const filename = `clip.${ext}`
    const url = temp_state.clip.output_url
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
}
</script>

<div class="flex w-full max-w-4xl flex-col gap-2 p-4">
    <!-- Upload Section -->
    <div class="rounded-lg bg-gray-100 p-4">
        <h2 class="mb-3 text-lg font-semibold">Upload Video</h2>
        <input
            type="file"
            accept="video/*"
            onchange={handle_video_upload}
            class="w-full rounded border border-gray-300 p-2"
        >
    </div>

    <!-- Video Preview -->
    {#if temp_state.clip.video_url}
        <div class="rounded-lg bg-gray-100 p-4">
            <h2 class="mb-3 text-lg font-semibold">Video Preview</h2>
            <video
                src={temp_state.clip.video_url}
                controls
                class="w-full rounded"
                onerror={() => temp_state.clip.error_message = "Video codec not supported by browser and can't be previewed. Try transcoding the video to H.264 first."}
            >
                <track kind="captions">
            </video>
            <p class="mt-2 text-sm text-gray-600">
                If the video doesn't load, your browser may not support this codec. Extracting a clip may still work.
            </p>
        </div>
    {/if}

    <!-- Timestamp Inputs -->
    <div class="flex flex-wrap items-center gap-4 rounded-lg bg-gray-100 p-4">
        <div class="flex flex-col gap-1">
            <label
                for="start-time"
                class="text-sm font-medium"
                >Start Time (HH:MM:SS.mmm)</label
            >
            <input
                id="start-time"
                type="text"
                bind:value={temp_state.clip.start_time}
                placeholder="00:00.000 or 00:00:00.000"
                class="rounded border border-gray-300 px-3 py-2"
            >
        </div>
        <div class="flex flex-col gap-1">
            <label
                for="end-time"
                class="text-sm font-medium"
                >End Time (HH:MM:SS.mmm)</label
            >
            <input
                id="end-time"
                type="text"
                bind:value={temp_state.clip.end_time}
                placeholder="00:00.000 or 00:00:00.000"
                class="rounded border border-gray-300 px-3 py-2"
            >
        </div>
        <button
            onclick={handle_extract}
            disabled={!temp_state.clip.video_file || temp_state.clip.is_processing}
            class="btn btn-primary mx-8"
        >
            {temp_state.clip.is_processing ? "Processing..." : "Extract Clip"}
        </button>
    </div>

    <!-- Messages -->
    {#if temp_state.clip.message}
        <div class="rounded-lg bg-green-100 p-3 text-green-800">{temp_state.clip.message}</div>
    {/if}
    {#if temp_state.clip.error_message}
        <div class="rounded-lg bg-red-100 p-3 text-red-800">{temp_state.clip.error_message}</div>
    {/if}

    <!-- Output Preview -->
    {#if temp_state.clip.output_url}
        <div class="rounded-lg bg-gray-100 p-4">
            <h2 class="mb-3 text-lg font-semibold">Extracted Clip</h2>
            <video
                src={temp_state.clip.output_url}
                controls
                class="mb-4 w-full rounded"
            >
                <track kind="captions">
            </video>
            <button
                onclick={handle_download}
                class="w-full rounded bg-green-600 px-6 py-3 text-white transition-colors hover:bg-green-700"
            >
                Download Clip
            </button>
        </div>
    {/if}
</div>
