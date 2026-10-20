<script lang="ts">
import { onDestroy } from "svelte"
import { clip_filename } from "$lib/media/clip-filename"
import { clip_v2_state, reset_output, revoke_all } from "$lib/media/clip-v2-state.svelte"
import { ClipError, default_output_kind, extract_clip, probe_media } from "$lib/media/mediabunny-clip"
import { clamp_timecode, format_timecode, parse_timecode, TimecodeError, validate_range } from "$lib/media/timecode"
import ExtractResult from "./ExtractResult.svelte"
import MediaDetails from "./MediaDetails.svelte"
import MediaPreview from "./MediaPreview.svelte"
import TimeInputs from "./TimeInputs.svelte"

let aborter: AbortController | null = null
let file_token = 0

let duration = $derived(clip_v2_state.source?.probe?.duration ?? null)
let has_video = $derived(clip_v2_state.source?.probe?.has_video ?? false)
let current_time = $state<number | null>(null)
let current_time_str = $derived(
    current_time !== null && Number.isFinite(current_time) ? format_timecode(current_time) : null,
)
let can_use_current = $derived(clip_v2_state.source !== null && current_time_str !== null)

function use_current(target: "start" | "end") {
    if (current_time_str === null) {
        return
    }
    if (target === "start") {
        clip_v2_state.start_str = current_time_str
    } else {
        clip_v2_state.end_str = current_time_str
    }
}

function source_name(): string {
    return clip_v2_state.source?.file.name ?? clip_v2_state.source?.probe?.file_name ?? ""
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
    if (clip_v2_state.source) {
        URL.revokeObjectURL(clip_v2_state.source.url)
    }
    reset_output()
    current_time = null
    clip_v2_state.source = { file, url: URL.createObjectURL(file), probe: null }
    try {
        const probe = await probe_media(file)
        if (mine !== file_token || clip_v2_state.source?.file !== file) {
            return
        }
        clip_v2_state.source.probe = probe
        if (probe.duration !== null) {
            clip_v2_state.start_str = format_timecode(0)
            clip_v2_state.end_str = format_timecode(probe.duration)
        }
    } catch (error) {
        if (mine !== file_token || clip_v2_state.source?.file !== file) {
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
    const source = clip_v2_state.source
    if (!source || clip_v2_state.is_processing) {
        return
    }
    const file = source.file
    const mine = file_token
    reset_output()
    clip_v2_state.is_processing = true
    try {
        const { start, end } = clamp_timecode(
            parse_timecode(clip_v2_state.start_str),
            parse_timecode(clip_v2_state.end_str),
            duration,
        )
        aborter = new AbortController()
        const extracted = await extract_clip({
            file,
            start,
            end,
            output_kind: default_output_kind({
                has_video,
                audio_codec: source.probe?.audio_codec,
                container: source.probe?.container,
            }),
            signal: aborter.signal,
        })
        const result_duration = format_timecode(end - start)
        const result_size_mb = (extracted.blob.size / 1024 / 1024).toFixed(2)
        clip_v2_state.result = {
            url: URL.createObjectURL(extracted.blob),
            mime: extracted.mime,
            ext: extracted.extension.replace(/^\./, ""),
            size_mb: result_size_mb,
            duration: result_duration,
        }
        clip_v2_state.message = `Clip ready: ${result_duration}, ${result_size_mb} MB`
    } catch (error) {
        if (error instanceof ClipError) {
            if (error.code === "CANCELLED") {
                if (mine !== file_token || clip_v2_state.source?.file !== file) {
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
    const source = clip_v2_state.source
    if (source?.probe && source.probe.duration === null) {
        source.probe.duration = value
        clip_v2_state.end_str = format_timecode(value)
    }
}

let times_valid = $derived.by(() => {
    const validation = validate_range(clip_v2_state.start_str, clip_v2_state.end_str)
    return validation.start_error === null && validation.end_error === null && validation.range_error === null
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

    {#if clip_v2_state.source}
        <div class="rounded-lg bg-gray-100 p-4">
            <h2 class="mb-3 text-lg font-semibold">Preview</h2>
            <MediaPreview
                url={clip_v2_state.source.url}
                {has_video}
                on_duration={handle_preview_duration}
                on_time={(value) => (current_time = value)}
                on_error={() =>
                    (clip_v2_state.error = "Preview failed: this codec may not be supported by the browser.")}
            />
            {#if clip_v2_state.source.probe}
                <MediaDetails details={clip_v2_state.source.probe} />
            {/if}
        </div>
    {/if}

    <TimeInputs
        start_str={clip_v2_state.start_str}
        end_str={clip_v2_state.end_str}
        has_source={clip_v2_state.source !== null}
        on_change={(start, end) => {
            clip_v2_state.start_str = start
            clip_v2_state.end_str = end
        }}
        on_use_current={use_current}
        {current_time_str}
        {can_use_current}
    />

    <div class="flex flex-row items-center justify-center gap-2 rounded-lg bg-gray-100 p-4">
        <button
            onclick={handle_extract}
            disabled={!clip_v2_state.source || clip_v2_state.is_processing || !times_valid}
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

    {#if clip_v2_state.result && clip_v2_state.source}
        <ExtractResult
            result={clip_v2_state.result}
            filename={clip_filename(
                source_name(),
                clip_v2_state.start_str,
                clip_v2_state.end_str,
                clip_v2_state.result.ext,
            )}
        />
    {/if}
</div>
