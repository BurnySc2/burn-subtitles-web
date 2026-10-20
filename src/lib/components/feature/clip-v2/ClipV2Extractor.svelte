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
    clipV2State.mediaDetails = null
    try {
        const probe = await probeMedia(file)
        if (mine !== file_token || clipV2State.sourceFile !== file) {
            return
        }
        clipV2State.duration = probe.duration
        clipV2State.hasVideo = probe.hasVideo
        clipV2State.hasAudio = probe.hasAudio
        clipV2State.mediaDetails = probe
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
            outputKind: defaultOutputKind({ hasVideo: clipV2State.hasVideo }),
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

let times_valid = $derived.by(() => {
    try {
        return parseTimecode(clipV2State.endStr) > parseTimecode(clipV2State.startStr)
    } catch {
        return false
    }
})

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
            {#if clipV2State.mediaDetails}
                {@const details = clipV2State.mediaDetails}
                <details class="mt-3">
                    <summary class="cursor-pointer text-sm font-medium text-gray-700">Media details</summary>
                    <dl class="mt-2 space-y-1 text-sm text-gray-500">
                        <div class="flex gap-2">
                            <dt class="font-medium">File:</dt>
                            <dd>{details.fileName}</dd>
                        </div>
                        <div class="flex gap-2">
                            <dt class="font-medium">Size:</dt>
                            <dd>{(details.fileSize / 1024 / 1024).toFixed(2)} MB</dd>
                        </div>
                        {#if details.container}
                            <div class="flex gap-2">
                                <dt class="font-medium">Container:</dt>
                                <dd>{details.container}</dd>
                            </div>
                        {/if}
                        {#if details.mimeType}
                            <div class="flex gap-2">
                                <dt class="font-medium">MIME:</dt>
                                <dd>{details.mimeType}</dd>
                            </div>
                        {/if}
                        {#if details.duration !== null}
                            <div class="flex gap-2">
                                <dt class="font-medium">Duration:</dt>
                                <dd>{formatTimecode(details.duration)}</dd>
                            </div>
                        {/if}
                        {#if details.overallBitrate !== null}
                            <div class="flex gap-2">
                                <dt class="font-medium">Overall bitrate:</dt>
                                <dd>{Math.round(details.overallBitrate / 1000)} kbps</dd>
                            </div>
                        {/if}
                        <div class="flex gap-2">
                            <dt class="font-medium">Tracks:</dt>
                            <dd>Video {details.videoCount} · Audio {details.audioCount}</dd>
                        </div>
                        {#if details.hasVideo}
                            {#if details.videoCodec}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Video codec:</dt>
                                    <dd>
                                        {details.videoCodec}
                                        {details.videoCodecParam ? ` (${details.videoCodecParam})` : ""}
                                    </dd>
                                </div>
                            {/if}
                            {#if details.displayWidth !== null && details.displayHeight !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Resolution:</dt>
                                    <dd>{details.displayWidth}x{details.displayHeight}</dd>
                                </div>
                            {/if}
                            {#if details.codedWidth !== null &&
                                details.codedHeight !== null &&
                                (details.codedWidth !== details.displayWidth ||
                                    details.codedHeight !== details.displayHeight)}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Coded size:</dt>
                                    <dd>{details.codedWidth}x{details.codedHeight}</dd>
                                </div>
                            {/if}
                            {#if details.frameRate !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Frame rate:</dt>
                                    <dd>{details.frameRate.toFixed(2)} fps</dd>
                                </div>
                            {/if}
                            {#if details.videoBitrate !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Video bitrate:</dt>
                                    <dd>{Math.round(details.videoBitrate / 1000)} kbps</dd>
                                </div>
                            {/if}
                        {/if}
                        {#if details.hasAudio}
                            {#if details.audioCodec}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Audio codec:</dt>
                                    <dd>
                                        {details.audioCodec}
                                        {details.audioCodecParam ? ` (${details.audioCodecParam})` : ""}
                                    </dd>
                                </div>
                            {/if}
                            {#if details.audioChannels !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Channels:</dt>
                                    <dd>{details.audioChannels}</dd>
                                </div>
                            {/if}
                            {#if details.audioSampleRate !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Sample rate:</dt>
                                    <dd>{details.audioSampleRate} Hz</dd>
                                </div>
                            {/if}
                            {#if details.audioBitrate !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Audio bitrate:</dt>
                                    <dd>{Math.round(details.audioBitrate / 1000)} kbps</dd>
                                </div>
                            {/if}
                        {/if}
                        <div class="flex gap-2">
                            <dt class="font-medium">Type:</dt>
                            <dd>
                                {details.kind}
                                {#if details.canPlay}
                                    <span class="ml-1 rounded bg-green-200 px-1.5 py-0.5 text-xs text-green-800"
                                        >plays in browser</span
                                    >
                                {:else}
                                    <span class="ml-1 rounded bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-800"
                                        >may not play in browser —
                                        <a
                                            href="/clip"
                                            class="underline"
                                            >try /clip v1</a
                                        ></span
                                    >
                                {/if}
                            </dd>
                        </div>
                    </dl>
                </details>
            {/if}
        </div>
    {/if}

    <TimeInputs
        startStr={clipV2State.startStr}
        endStr={clipV2State.endStr}
        hasSource={clipV2State.sourceFile !== null}
        onChange={(start, end) => {
            clipV2State.startStr = start
            clipV2State.endStr = end
        }}
    />

    <div class="flex flex-row items-center justify-center gap-2 rounded-lg bg-gray-100 p-4">
        <button
            onclick={handle_extract}
            disabled={!clipV2State.sourceFile || clipV2State.isProcessing || !times_valid}
            class="btn btn-primary inline-flex flex-1 items-center justify-center gap-2"
        >
            {#if clipV2State.isProcessing}
                <Spinner />
                Extracting...
            {:else}
                Extract Clip
            {/if}
        </button>
        {#if clipV2State.isProcessing}
            <button
                onclick={() => aborter?.abort()}
                class="rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
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
