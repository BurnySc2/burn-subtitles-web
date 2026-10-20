<script lang="ts">
import { onDestroy } from "svelte"
import { clip_v2_state, reset_output, revoke_all } from "$lib/media/clip-v2-state.svelte"
import { ClipError, default_output_kind, extract_clip, probe_media } from "$lib/media/mediabunny-clip"
import { clamp_timecode, format_timecode, parse_timecode, TimecodeError } from "$lib/media/timecode"
import MediaPreview from "./MediaPreview.svelte"
import TimeInputs from "./TimeInputs.svelte"

let aborter: AbortController | null = null
let file_token = 0
let result_ext = $state("mp4")
let result_size_mb = $state("")
let result_duration = $state("")

function sanitize_filename(value: string): string {
    const printable = [...value].filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127).join("")
    return printable
        .replaceAll(":", "-")
        .replace(/[/\\?%*|"<>+]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60)
        .trim()
}

function clip_basename(): string {
    const raw = clip_v2_state.source_file?.name ?? clip_v2_state.media_details?.file_name ?? ""
    const dot = raw.lastIndexOf(".")
    const stem = dot > 0 ? raw.slice(0, dot) : raw
    return sanitize_filename(stem) || "clip"
}

function clip_filename(): string {
    const ext = result_ext.replace(/^\./, "")
    return `${clip_basename()}_${sanitize_filename(clip_v2_state.start_str)}-${sanitize_filename(clip_v2_state.end_str)}.${ext}`
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
    if (clip_v2_state.source_url) {
        URL.revokeObjectURL(clip_v2_state.source_url)
    }
    reset_output()
    clip_v2_state.source_file = file
    clip_v2_state.source_url = URL.createObjectURL(file)
    clip_v2_state.duration = null
    clip_v2_state.has_video = false
    clip_v2_state.has_audio = false
    clip_v2_state.media_details = null
    try {
        const probe = await probe_media(file)
        if (mine !== file_token || clip_v2_state.source_file !== file) {
            return
        }
        clip_v2_state.duration = probe.duration
        clip_v2_state.has_video = probe.has_video
        clip_v2_state.has_audio = probe.has_audio
        clip_v2_state.media_details = probe
        if (probe.duration !== null) {
            clip_v2_state.start_str = format_timecode(0)
            clip_v2_state.end_str = format_timecode(probe.duration)
        }
    } catch (error) {
        if (mine !== file_token || clip_v2_state.source_file !== file) {
            return
        }
        if (error instanceof ClipError) {
            clip_v2_state.error = error.message
        } else {
            clip_v2_state.error = `Failed to read media: ${(error as Error).message}`
        }
    } finally {
        input.value = ""
    }
}

async function handle_extract() {
    if (!clip_v2_state.source_file || clip_v2_state.is_processing) {
        return
    }
    const file = clip_v2_state.source_file
    const mine = file_token
    reset_output()
    clip_v2_state.is_processing = true
    try {
        const { start, end } = clamp_timecode(
            parse_timecode(clip_v2_state.start_str),
            parse_timecode(clip_v2_state.end_str),
            clip_v2_state.duration,
        )
        aborter = new AbortController()
        const result = await extract_clip({
            file,
            start,
            end,
            output_kind: default_output_kind({
                has_video: clip_v2_state.has_video,
                audio_codec: clip_v2_state.media_details?.audio_codec,
                container: clip_v2_state.media_details?.container,
            }),
            signal: aborter.signal,
        })
        clip_v2_state.result_url = URL.createObjectURL(result.blob)
        clip_v2_state.result_mime = result.mime
        result_ext = result.extension.replace(/^\./, "")
        result_size_mb = (result.blob.size / 1024 / 1024).toFixed(2)
        result_duration = format_timecode(end - start)
        clip_v2_state.message = `Clip ready: ${result_duration}, ${result_size_mb} MB`
    } catch (error) {
        if (error instanceof ClipError) {
            if (error.code === "CANCELLED") {
                if (mine !== file_token || clip_v2_state.source_file !== file) {
                    return
                }
                clip_v2_state.message = "Cancelled."
            } else {
                clip_v2_state.error = error.message
            }
        } else if (error instanceof TimecodeError) {
            clip_v2_state.error = error.message
        } else {
            clip_v2_state.error = `Failed to extract clip: ${(error as Error).message}`
        }
    } finally {
        clip_v2_state.is_processing = false
        aborter = null
    }
}

function handle_preview_duration(value: number) {
    if (clip_v2_state.duration === null) {
        clip_v2_state.duration = value
        clip_v2_state.end_str = format_timecode(value)
    }
}

let times_valid = $derived.by(() => {
    try {
        return parse_timecode(clip_v2_state.end_str) > parse_timecode(clip_v2_state.start_str)
    } catch {
        return false
    }
})

onDestroy(() => {
    aborter?.abort()
    revoke_all()
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

    {#if clip_v2_state.source_url}
        <div class="rounded-lg bg-gray-100 p-4">
            <h2 class="mb-3 text-lg font-semibold">Preview</h2>
            <MediaPreview
                url={clip_v2_state.source_url}
                has_video={clip_v2_state.has_video}
                on_duration={handle_preview_duration}
                on_error={() =>
                    (clip_v2_state.error = "Preview failed: this codec may not be supported by the browser.")}
            />
            {#if clip_v2_state.media_details}
                {@const details = clip_v2_state.media_details}
                <details class="mt-3">
                    <summary class="cursor-pointer text-sm font-medium text-gray-700">Media details</summary>
                    <dl class="mt-2 space-y-1 text-sm text-gray-500">
                        <div class="flex gap-2">
                            <dt class="font-medium">File:</dt>
                            <dd>{details.file_name}</dd>
                        </div>
                        <div class="flex gap-2">
                            <dt class="font-medium">Size:</dt>
                            <dd>{(details.file_size / 1024 / 1024).toFixed(2)} MB</dd>
                        </div>
                        {#if details.container}
                            <div class="flex gap-2">
                                <dt class="font-medium">Container:</dt>
                                <dd>{details.container}</dd>
                            </div>
                        {/if}
                        {#if details.mime_type}
                            <div class="flex gap-2">
                                <dt class="font-medium">MIME:</dt>
                                <dd>{details.mime_type}</dd>
                            </div>
                        {/if}
                        {#if details.duration !== null}
                            <div class="flex gap-2">
                                <dt class="font-medium">Duration:</dt>
                                <dd>{format_timecode(details.duration)}</dd>
                            </div>
                        {/if}
                        {#if details.overall_bitrate !== null}
                            <div class="flex gap-2">
                                <dt class="font-medium">Overall bitrate:</dt>
                                <dd>{Math.round(details.overall_bitrate / 1000)} kbps</dd>
                            </div>
                        {/if}
                        <div class="flex gap-2">
                            <dt class="font-medium">Tracks:</dt>
                            <dd>Video {details.video_count} · Audio {details.audio_count}</dd>
                        </div>
                        {#if details.has_video}
                            {#if details.video_codec}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Video codec:</dt>
                                    <dd>
                                        {details.video_codec}
                                        {details.video_codec_param ? ` (${details.video_codec_param})` : ""}
                                    </dd>
                                </div>
                            {/if}
                            {#if details.display_width !== null && details.display_height !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Resolution:</dt>
                                    <dd>{details.display_width}x{details.display_height}</dd>
                                </div>
                            {/if}
                            {#if details.coded_width !== null &&
                                details.coded_height !== null &&
                                (details.coded_width !== details.display_width ||
                                    details.coded_height !== details.display_height)}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Coded size:</dt>
                                    <dd>{details.coded_width}x{details.coded_height}</dd>
                                </div>
                            {/if}
                            {#if details.frame_rate !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Frame rate:</dt>
                                    <dd>{details.frame_rate.toFixed(2)} fps</dd>
                                </div>
                            {/if}
                            {#if details.video_bitrate !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Video bitrate:</dt>
                                    <dd>{Math.round(details.video_bitrate / 1000)} kbps</dd>
                                </div>
                            {/if}
                        {/if}
                        {#if details.has_audio}
                            {#if details.audio_codec}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Audio codec:</dt>
                                    <dd>
                                        {details.audio_codec}
                                        {details.audio_codec_param ? ` (${details.audio_codec_param})` : ""}
                                    </dd>
                                </div>
                            {/if}
                            {#if details.audio_channels !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Channels:</dt>
                                    <dd>{details.audio_channels}</dd>
                                </div>
                            {/if}
                            {#if details.audio_sample_rate !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Sample rate:</dt>
                                    <dd>{details.audio_sample_rate} Hz</dd>
                                </div>
                            {/if}
                            {#if details.audio_bitrate !== null}
                                <div class="flex gap-2">
                                    <dt class="font-medium">Audio bitrate:</dt>
                                    <dd>{Math.round(details.audio_bitrate / 1000)} kbps</dd>
                                </div>
                            {/if}
                        {/if}
                        <div class="flex gap-2">
                            <dt class="font-medium">Type:</dt>
                            <dd>
                                {details.kind}
                                {#if details.can_play}
                                    <span class="ml-1 rounded bg-green-200 px-1.5 py-0.5 text-xs text-green-800"
                                        >plays in browser</span
                                    >
                                {:else}
                                    <span class="ml-1 rounded bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-800"
                                        >may not play in browser</span
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
        start_str={clip_v2_state.start_str}
        end_str={clip_v2_state.end_str}
        has_source={clip_v2_state.source_file !== null}
        on_change={(start, end) => {
            clip_v2_state.start_str = start
            clip_v2_state.end_str = end
        }}
    />

    <div class="flex flex-row items-center justify-center gap-2 rounded-lg bg-gray-100 p-4">
        <button
            onclick={handle_extract}
            disabled={!clip_v2_state.source_file || clip_v2_state.is_processing || !times_valid}
            class="btn btn-primary inline-flex flex-1 items-center justify-center gap-2"
        >
            {#if clip_v2_state.is_processing}
                <div
                    class="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                    aria-hidden="true"
                ></div>
                Extracting...
            {:else}
                Extract Clip
            {/if}
        </button>
        {#if clip_v2_state.is_processing}
            <!-- WHY btn base: unlayered button:not(.btn) in app.css beats layered bg-red-600 -->
            <button
                onclick={() => aborter?.abort()}
                class="btn bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
            >
                Cancel
            </button>
        {/if}
    </div>

    {#if clip_v2_state.message}
        <div class="rounded-lg bg-green-100 p-3 text-green-800">{clip_v2_state.message}</div>
    {/if}
    {#if clip_v2_state.error}
        <div class="rounded-lg bg-red-100 p-3 text-red-800">{clip_v2_state.error}</div>
    {/if}

    {#if clip_v2_state.result_url}
        <div class="rounded-lg bg-gray-100 p-4">
            <h2 class="mb-3 text-lg font-semibold">Extracted Clip</h2>
            {#if (clip_v2_state.result_mime ?? "").startsWith("video")}
                <video
                    src={clip_v2_state.result_url}
                    controls
                    class="mb-4 w-full rounded"
                >
                    <track kind="captions">
                </video>
            {:else}
                <audio
                    src={clip_v2_state.result_url}
                    controls
                    class="mb-4 w-full"
                >
                    <track kind="captions">
                </audio>
            {/if}
            <p class="mb-4 text-sm text-gray-600">
                Duration {result_duration} · {result_size_mb} MB · {clip_v2_state.result_mime}
            </p>
            <a
                href={clip_v2_state.result_url}
                download={clip_filename()}
                class="block w-full rounded bg-green-600 px-6 py-3 text-center text-white transition-colors hover:bg-green-700"
            >
                Download Clip
            </a>
        </div>
    {/if}
</div>
