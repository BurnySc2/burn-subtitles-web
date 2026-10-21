<script lang="ts">
import { onDestroy } from "svelte"
import { ClipError, probe_media } from "$lib/media/mediabunny-clip"
import { render_transition } from "$lib/media/mediabunny-transition"
import { TimecodeError } from "$lib/media/timecode"
import { transition_filename } from "$lib/media/transition-filename"
import { reset_output_transition, revoke_all_transition, transition_state } from "$lib/media/transition-state.svelte"
import {
    estimate_frame_count,
    FRAME_COUNT_WARNING_THRESHOLD,
    parse_crf_override,
    resolve_audio_bitrate,
    resolve_duration_seconds,
    resolve_output_dims,
    resolve_output_fps,
    resolve_start_seconds,
    total_transition_duration,
    validate_transition_range,
} from "$lib/media/transition-utils"
import DualUpload from "./DualUpload.svelte"
import TransitionPreview from "./TransitionPreview.svelte"
import TransitionResult from "./TransitionResult.svelte"
import TransitionSettings, { type TransitionSettingsPatch } from "./TransitionSettings.svelte"

let aborter: AbortController | null = null
let file_token = 0

let slot_a = $derived({ file: transition_state.source_a?.file ?? null, url: transition_state.source_a?.url ?? null })
let slot_b = $derived({ file: transition_state.source_b?.file ?? null, url: transition_state.source_b?.url ?? null })
let preview_duration = $derived.by(() => {
    const parsed = Number.parseFloat(transition_state.duration_str.trim())
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
})
let preview_start = $derived.by(() => {
    const parsed = Number.parseFloat(transition_state.start_str.trim())
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
})
let preview_total = $derived(
    total_transition_duration(preview_start, transition_state.source_b?.probe?.duration ?? null),
)
let can_render = $derived(
    transition_state.source_a !== null && transition_state.source_b !== null && !transition_state.is_processing,
)
let resolved_fps = $derived(
    resolve_output_fps(
        transition_state.source_a?.probe ?? null,
        transition_state.source_b?.probe ?? null,
        transition_state.fps_mode,
    ),
)
let estimated_frames = $derived(preview_total === null ? 0 : estimate_frame_count(preview_total, resolved_fps))

function apply_patch(patch: TransitionSettingsPatch) {
    if (patch.duration !== undefined) {
        transition_state.duration_str = patch.duration
    }
    if (patch.start !== undefined) {
        transition_state.start_str = patch.start
    }
    if (patch.resolution !== undefined) {
        transition_state.res_source = patch.resolution
    }
    if (patch.fps !== undefined) {
        transition_state.fps_mode = patch.fps
    }
    if (patch.quality !== undefined) {
        transition_state.quality = patch.quality
    }
    if (patch.audio_quality !== undefined) {
        transition_state.audio_quality = patch.audio_quality
    }
    if (patch.crf_override !== undefined) {
        transition_state.crf_override = patch.crf_override
    }
    if (patch.easing !== undefined) {
        transition_state.easing = patch.easing
    }
}

async function handle_file(slot: "a" | "b", file: File) {
    aborter?.abort()
    aborter = null
    const mine = ++file_token
    const key = slot === "a" ? "source_a" : "source_b"
    if (transition_state[key]) {
        URL.revokeObjectURL(transition_state[key].url)
    }
    reset_output_transition()
    transition_state[key] = { file, url: URL.createObjectURL(file), probe: null }
    try {
        const probe = await probe_media(file)
        if (mine !== file_token || transition_state[key]?.file !== file) {
            return
        }
        transition_state[key].probe = probe
    } catch (error) {
        if (mine !== file_token || transition_state[key]?.file !== file) {
            return
        }
        if (error instanceof ClipError) {
            transition_state.error = error.message
        } else {
            transition_state.error = `Failed to read media: ${(error as Error).message}`
        }
    }
}

async function handle_render() {
    const source_a = transition_state.source_a
    const source_b = transition_state.source_b
    if (!source_a || !source_b || transition_state.is_processing) {
        return
    }
    const file_a = source_a.file
    const file_b = source_b.file
    const mine = file_token
    reset_output_transition()
    transition_state.is_processing = true
    try {
        const len_a = source_a.probe?.duration ?? null
        const len_b = source_b.probe?.duration ?? null
        if (len_a === null || len_b === null) {
            throw new ClipError("INVALID_RANGE", "Source durations are unknown — wait for probing to finish.")
        }
        const duration = resolve_duration_seconds(transition_state.duration_str, len_a, len_b)
        const start = resolve_start_seconds(transition_state.start_str, len_a, duration)
        validate_transition_range(start, duration, len_a, len_b)
        const total = total_transition_duration(start, len_b)
        if (total === null) {
            throw new ClipError("INVALID_RANGE", "Source durations are unknown — wait for probing to finish.")
        }
        const dims = resolve_output_dims(source_a.probe, source_b.probe, transition_state.res_source)
        if (!dims) {
            throw new ClipError("INVALID_RANGE", "No source has resolution metadata yet — wait for probing to finish.")
        }
        const fps = resolve_output_fps(source_a.probe, source_b.probe, transition_state.fps_mode)
        const audio_bitrate = resolve_audio_bitrate(source_a.probe, source_b.probe, transition_state.audio_quality)
        const crf = parse_crf_override(transition_state.crf_override ?? null)
        aborter = new AbortController()
        const rendered = await render_transition({
            file_a,
            file_b,
            probe_a: source_a.probe,
            probe_b: source_b.probe,
            duration,
            start_a: start,
            total_duration: total,
            width: dims.width,
            height: dims.height,
            fps,
            quality: transition_state.quality,
            crf,
            audio_quality: transition_state.audio_quality,
            audio_bitrate,
            easing: transition_state.easing,
            on_progress: (value) => {
                transition_state.progress = value
            },
            signal: aborter.signal,
        })
        transition_state.result = {
            url: URL.createObjectURL(rendered.blob),
            mime: rendered.mime,
            ext: rendered.extension.replace(/^\./, ""),
            size_bytes: rendered.blob.size,
            duration: `${total.toFixed(2)}s`,
        }
        transition_state.message = "Transition ready."
    } catch (error) {
        if (error instanceof ClipError) {
            if (error.code === "CANCELLED") {
                if (
                    mine !== file_token ||
                    transition_state.source_a?.file !== file_a ||
                    transition_state.source_b?.file !== file_b
                ) {
                    return
                }
                transition_state.message = "Cancelled."
            } else {
                transition_state.error = error.message
            }
        } else if (error instanceof TimecodeError) {
            transition_state.error = error.message
        } else {
            transition_state.error = `Failed to render transition: ${(error as Error).message}`
        }
    } finally {
        transition_state.is_processing = false
        aborter = null
    }
}

let result_filename = $derived.by(() => {
    const result = transition_state.result
    if (!result || !transition_state.source_a || !transition_state.source_b) {
        return ""
    }
    return transition_filename(
        transition_state.source_a.file.name,
        transition_state.source_b.file.name,
        preview_total ?? preview_duration,
        result.ext,
    )
})

onDestroy(() => {
    aborter?.abort()
    revoke_all_transition()
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

    <DualUpload
        {slot_a}
        {slot_b}
        on_file={handle_file}
    />

    {#if transition_state.source_a && transition_state.source_b}
        <TransitionPreview
            url_a={transition_state.source_a.url}
            url_b={transition_state.source_b.url}
            total_duration={preview_total ?? preview_start + preview_duration}
            start_a={preview_start}
            blend_duration={preview_duration}
            easing={transition_state.easing}
        />
    {/if}

    <TransitionSettings
        duration={transition_state.duration_str}
        start={transition_state.start_str}
        resolution={transition_state.res_source}
        fps={transition_state.fps_mode}
        quality={transition_state.quality}
        audio_quality={transition_state.audio_quality}
        crf_override={transition_state.crf_override == null ? "" : String(transition_state.crf_override)}
        easing={transition_state.easing}
        on_change={apply_patch}
    />

    {#if estimated_frames > FRAME_COUNT_WARNING_THRESHOLD}
        <div
            class="rounded-lg bg-yellow-100 p-3 text-yellow-800"
            role="alert"
        >
            High frame count ({estimated_frames}
            frames: {(preview_total ?? preview_duration).toFixed(2)}s x {resolved_fps}fps) may OOM tab — proceed anyway?
        </div>
    {/if}

    <div class="flex flex-row items-center justify-center gap-2 rounded-lg bg-gray-100 p-4">
        <button
            onclick={handle_render}
            disabled={!can_render}
            class="btn btn-primary inline-flex flex-1 items-center justify-center gap-2"
        >
            {#if transition_state.is_processing}
                <div
                    class="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                    aria-hidden="true"
                ></div>
                Rendering... {Math.round(transition_state.progress * 100)}%
            {:else}
                Render Transition
            {/if}
        </button>
        {#if transition_state.is_processing}
            <button
                onclick={() => aborter?.abort()}
                class="btn bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
            >
                Cancel
            </button>
        {/if}
    </div>

    {#if transition_state.is_processing}
        <div
            class="h-2 w-full overflow-hidden rounded bg-gray-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(transition_state.progress * 100)}
        >
            <div
                class="h-full bg-green-600 transition-all"
                style:width={`${Math.round(transition_state.progress * 100)}%`}
            ></div>
        </div>
    {/if}

    {#if transition_state.message}
        <div class="rounded-lg bg-green-100 p-3 text-green-800">{transition_state.message}</div>
    {/if}
    {#if transition_state.error}
        <div class="rounded-lg bg-red-100 p-3 text-red-800">{transition_state.error}</div>
    {/if}

    {#if transition_state.result}
        <TransitionResult
            result={transition_state.result}
            filename={result_filename}
        />
    {/if}
</div>
