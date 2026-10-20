<script lang="ts">
import { onDestroy } from "svelte"
import Spinner from "$lib/components/ui/Spinner.svelte"
import { clipV2State, resetOutput, revokeAll } from "$lib/media/clip-v2-state.svelte"
import { ClipError, defaultOutputKind, extractClip, probeMedia } from "$lib/media/mediabunny-clip"
import { clampTimecode, formatTimecode, parseTimecode, TimecodeError } from "$lib/media/timecode"
import MediaPreview from "./MediaPreview.svelte"
import TimeInputs from "./TimeInputs.svelte"

let aborter: AbortController | null = null
let file_token = 0
let is_unsupported = $state(false)
let result_ext = $state("mp4")
let result_size_mb = $state("")
let result_duration = $state("")

function sanitize_filename(value: string): string {
    return value.replaceAll(":", "-")
}

async function handle_file(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
        return
    }
    aborter?.abort()
    aborter = null
    const mine = ++file_token
    if (clipV2State.sourceUrl) {
        URL.revokeObjectURL(clipV2State.sourceUrl)
    }
    resetOutput()
    is_unsupported = false
    clipV2State.sourceFile = file
    clipV2State.sourceUrl = URL.createObjectURL(file)
    clipV2State.duration = null
    clipV2State.hasVideo = false
    clipV2State.hasAudio = false
    try {
        const probe = await probeMedia(file)
        if (mine !== file_token || clipV2State.sourceFile !== file) {
            return
        }
        clipV2State.duration = probe.duration
        clipV2State.hasVideo = probe.hasVideo
        clipV2State.hasAudio = probe.hasAudio
        if (probe.duration !== null) {
            clipV2State.startStr = formatTimecode(0)
            clipV2State.endStr = formatTimecode(probe.duration)
        }
    } catch (error) {
        if (mine !== file_token || clipV2State.sourceFile !== file) {
            return
        }
        if (error instanceof ClipError && error.code === "UNSUPPORTED") {
            clipV2State.error = error.message
            is_unsupported = true
        } else {
            clipV2State.error = `Failed to read media: ${(error as Error).message}`
        }
    } finally {
        input.value = ""
    }
}

async function handle_extract() {
    if (!clipV2State.sourceFile || clipV2State.isProcessing) {
        return
    }
    const file = clipV2State.sourceFile
    const mine = file_token
    resetOutput()
    is_unsupported = false
    clipV2State.isProcessing = true
    try {
        const { start, end } = clampTimecode(
            parseTimecode(clipV2State.startStr),
            parseTimecode(clipV2State.endStr),
            clipV2State.duration,
        )
        aborter = new AbortController()
        const result = await extractClip({
            file,
            start,
            end,
            outputKind: defaultOutputKind({
                duration: clipV2State.duration,
                hasVideo: clipV2State.hasVideo,
                hasAudio: clipV2State.hasAudio,
                kind: clipV2State.hasVideo ? "video" : "audio-only",
            }),
            signal: aborter.signal,
        })
        clipV2State.resultUrl = URL.createObjectURL(result.blob)
        clipV2State.resultMime = result.mime
        result_ext = result.extension.replace(/^\./, "")
        result_size_mb = (result.blob.size / 1024 / 1024).toFixed(2)
        result_duration = formatTimecode(end - start)
        clipV2State.message = `Clip ready: ${result_duration}, ${result_size_mb} MB`
    } catch (error) {
        if (error instanceof ClipError) {
            if (error.code === "CANCELLED") {
                if (mine !== file_token || clipV2State.sourceFile !== file) {
                    return
                }
                clipV2State.message = "Cancelled."
            } else if (error.code === "UNSUPPORTED") {
                clipV2State.error = error.message
                is_unsupported = true
            } else {
                clipV2State.error = error.message
            }
        } else if (error instanceof TimecodeError) {
            clipV2State.error = error.message
        } else {
            clipV2State.error = `Failed to extract clip: ${(error as Error).message}`
        }
    } finally {
        clipV2State.isProcessing = false
        aborter = null
    }
}

function handle_preview_duration(value: number) {
    if (clipV2State.duration === null) {
        clipV2State.duration = value
        clipV2State.endStr = formatTimecode(value)
    }
}

onDestroy(() => {
    aborter?.abort()
    revokeAll()
})
</script>

<div class="flex w-full max-w-4xl flex-col gap-2 p-4">
    <p class="flex items-center justify-center gap-1.5 text-center text-sm text-gray-500">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
            aria-hidden="true"
        >
            <rect
                width="18"
                height="11"
                x="3"
                y="11"
                rx="2"
                ry="2"
            />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        No uploads, no servers — your media stays on this device.
    </p>
    <div class="rounded-lg bg-gray-100 p-4">
        <h2 class="mb-3 text-lg font-semibold">Upload Video or Audio</h2>
        <input
            type="file"
            accept="video/*,audio/*"
            onchange={handle_file}
            class="w-full rounded border border-gray-300 p-2"
        >
    </div>

    {#if clipV2State.sourceUrl}
        <div class="rounded-lg bg-gray-100 p-4">
            <h2 class="mb-3 text-lg font-semibold">Preview</h2>
            <MediaPreview
                url={clipV2State.sourceUrl}
                hasVideo={clipV2State.hasVideo}
                onDuration={handle_preview_duration}
                onError={() => (clipV2State.error = "Preview failed: this codec may not be supported by the browser.")}
            />
        </div>
    {/if}

    <TimeInputs
        startStr={clipV2State.startStr}
        endStr={clipV2State.endStr}
        onChange={(start, end) => {
            clipV2State.startStr = start
            clipV2State.endStr = end
        }}
    />

    <div class="flex flex-col items-center gap-3 rounded-lg bg-gray-100 p-4">
        <button
            onclick={handle_extract}
            disabled={!clipV2State.sourceFile || clipV2State.isProcessing}
            class="btn btn-primary w-full"
        >
            {clipV2State.isProcessing ? "Processing..." : "Extract Clip"}
        </button>
        {#if clipV2State.isProcessing}
            <Spinner />
            <button
                onclick={() => aborter?.abort()}
                class="rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
            >
                Cancel
            </button>
        {/if}
    </div>

    {#if clipV2State.message}
        <div class="rounded-lg bg-green-100 p-3 text-green-800">{clipV2State.message}</div>
    {/if}
    {#if clipV2State.error}
        <div class="rounded-lg bg-red-100 p-3 text-red-800">
            {clipV2State.error}
            {#if is_unsupported}
                <a
                    href="/clip"
                    class="ml-2 underline"
                    >Try /clip v1.</a
                >
            {/if}
        </div>
    {/if}

    {#if clipV2State.resultUrl}
        <div class="rounded-lg bg-gray-100 p-4">
            <h2 class="mb-3 text-lg font-semibold">Extracted Clip</h2>
            {#if (clipV2State.resultMime ?? "").startsWith("video")}
                <video
                    src={clipV2State.resultUrl}
                    controls
                    class="mb-4 w-full rounded"
                >
                    <track kind="captions">
                </video>
            {:else}
                <audio
                    src={clipV2State.resultUrl}
                    controls
                    class="mb-4 w-full"
                ></audio>
            {/if}
            <p class="mb-4 text-sm text-gray-600">
                Duration {result_duration} · {result_size_mb} MB · {clipV2State.resultMime}
            </p>
            <a
                href={clipV2State.resultUrl}
                download={`clip-${sanitize_filename(clipV2State.startStr)}-${sanitize_filename(clipV2State.endStr)}.${result_ext}`}
                class="block w-full rounded bg-green-600 px-6 py-3 text-center text-white transition-colors hover:bg-green-700"
            >
                Download Clip
            </a>
        </div>
    {/if}
</div>
