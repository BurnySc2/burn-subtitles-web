<script lang="ts">
import { onDestroy, onMount } from "svelte"
import ViewerFilePicker from "$lib/components/feature/viewer/ViewerFilePicker.svelte"
import ViewerInspector from "$lib/components/feature/viewer/ViewerInspector.svelte"
import ViewerStage from "$lib/components/feature/viewer/ViewerStage.svelte"
import ViewerTransport from "$lib/components/feature/viewer/ViewerTransport.svelte"
import { copy_text, format_viewer_summary } from "$lib/media/framecode"
import { ClipError, probe_media } from "$lib/media/mediabunny-clip"
import { reset_playback, revoke_viewer, viewer_state } from "$lib/media/viewer-state.svelte"
import { effective_fps, step_frame, time_to_frame } from "$lib/media/viewer-step"

let file_token = 0
let video_el: HTMLVideoElement | HTMLAudioElement | null = $state(null)
let video_duration: number | null = $state(null)
let stage_wrapper: HTMLDivElement | null = $state(null)

let fps = $derived(effective_fps(viewer_state.source?.probe?.frame_rate))
let duration = $derived(viewer_state.source?.probe?.duration ?? video_duration ?? null)
let has_video = $derived.by(() => {
    const source = viewer_state.source
    if (!source) {
        return false
    }
    if (source.probe) {
        return source.probe.has_video
    }
    return !source.file.type.startsWith("audio")
})

async function handle_file(file: File): Promise<void> {
    const mine = ++file_token
    if (viewer_state.source) {
        URL.revokeObjectURL(viewer_state.source.url)
    }
    reset_playback()
    video_duration = null
    video_el = null
    viewer_state.source = { file, url: URL.createObjectURL(file), probe: null }
    try {
        const probe = await probe_media(file)
        if (mine !== file_token || viewer_state.source?.file !== file) {
            return
        }
        viewer_state.source.probe = probe
    } catch (error) {
        if (mine !== file_token || viewer_state.source?.file !== file) {
            return
        }
        if (error instanceof ClipError) {
            viewer_state.error = error.message
        } else {
            viewer_state.error = `Failed to read media: ${(error as Error).message}`
        }
    }
}

function handle_remove(): void {
    file_token++
    if (viewer_state.source) {
        URL.revokeObjectURL(viewer_state.source.url)
    }
    video_el = null
    video_duration = null
    viewer_state.source = null
    reset_playback()
}

function handle_tick(tick: { media_time: number; presented_frames?: number }): void {
    viewer_state.playback.current_time = tick.media_time
    viewer_state.playback.presented_frame = time_to_frame(tick.media_time, fps)
    viewer_state.playback.rvfc_supported = tick.presented_frames !== undefined
    viewer_state.playback.measured_fps = null
}

function handle_seek(time: number): void {
    viewer_state.playback.current_time = time
    viewer_state.playback.presented_frame = time_to_frame(time, fps)
    viewer_state.playback.rvfc_supported =
        !!video_el && video_el instanceof HTMLVideoElement && "requestVideoFrameCallback" in video_el
}

function handle_duration(value: number): void {
    video_duration = value
}

function handle_error(): void {
    viewer_state.error = "Preview failed: this codec may not be supported by the browser."
}

function toggle_fullscreen(): void {
    if (typeof document === "undefined") {
        return
    }
    if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {})
    } else {
        void stage_wrapper?.requestFullscreen().catch(() => {})
    }
}

function toggle_play(): void {
    if (!video_el) {
        return
    }
    if (video_el.paused) {
        void video_el.play()
    } else {
        video_el.pause()
    }
}

function step_frames(delta_frames: number): void {
    if (!video_el) {
        return
    }
    video_el.pause()
    video_el.currentTime = step_frame(video_el.currentTime, fps, delta_frames, duration)
}

function seek_seconds(delta: number): void {
    if (!video_el) {
        return
    }
    const base = Number.isFinite(video_el.currentTime) ? video_el.currentTime : 0
    const target = base + delta
    video_el.currentTime = duration === null ? Math.max(0, target) : Math.min(Math.max(0, target), duration)
}

function seek_absolute(time: number): void {
    if (!video_el) {
        return
    }
    video_el.pause()
    video_el.currentTime = time
}

async function copy_summary(): Promise<void> {
    const time = viewer_state.playback.current_time
    if (time === null) {
        return
    }
    const ok = await copy_text(format_viewer_summary(time, fps, duration))
    viewer_state.message = ok ? "Copied summary." : "Copy failed."
}

function is_editable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false
    }
    const tag = target.tagName
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return true
    }
    return target.isContentEditable
}

function on_keydown(event: KeyboardEvent): void {
    // Media focus falls through to custom handling + preventDefault.
    if (is_editable(event.target)) {
        return
    }
    if (event.target instanceof HTMLButtonElement) {
        return
    }
    if (event.target instanceof HTMLInputElement && event.target.type === "range") {
        return
    }
    if (!viewer_state.source || !video_el) {
        return
    }
    const key = event.key
    if (key === " " || key === "k") {
        event.preventDefault()
        toggle_play()
    } else if (key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault()
        const direction = key === "ArrowLeft" ? -1 : 1
        if (event.ctrlKey || event.metaKey) {
            seek_seconds(10 * direction)
        } else {
            step_frames((event.shiftKey ? 10 : 1) * direction)
        }
    } else if (key === "j") {
        event.preventDefault()
        seek_seconds(-1)
    } else if (key === "l") {
        event.preventDefault()
        seek_seconds(1)
    } else if (key === "c") {
        event.preventDefault()
        void copy_summary()
    } else if (key === "f" || key === "F") {
        event.preventDefault()
        toggle_fullscreen()
    } else if (key === "Home") {
        event.preventDefault()
        seek_absolute(0)
    } else if (key === "End") {
        event.preventDefault()
        if (duration !== null) {
            seek_absolute(duration)
        }
    }
}

onMount(() => {
    window.addEventListener("keydown", on_keydown)
    return () => {
        window.removeEventListener("keydown", on_keydown)
    }
})

onDestroy(() => {
    revoke_viewer()
})
</script>

<div class="mx-auto max-w-5xl p-6">
    <h1 class="text-2xl font-bold">Frame Viewer</h1>
    <p class="mt-1 text-sm text-gray-500">Local only, no uploads — your media stays on this device.</p>
    <div class="mt-4 flex flex-col gap-4">
        <div class="section">
            <ViewerFilePicker
                on_file={handle_file}
                on_remove={handle_remove}
            />
        </div>
        {#if viewer_state.source}
            <div class="section">
                <ViewerStage
                    video_ref={(el) => (video_el = el)}
                    wrapper_ref={(el) => (stage_wrapper = el)}
                    url={viewer_state.source.url}
                    {has_video}
                    on_tick={handle_tick}
                    on_duration={handle_duration}
                    on_error={handle_error}
                    on_seeked={handle_seek}
                />
            </div>
            <div class="section">
                <ViewerTransport
                    {video_el}
                    {fps}
                    {duration}
                    current_time={viewer_state.playback.current_time}
                    disabled={viewer_state.source === null}
                    on_fullscreen={toggle_fullscreen}
                />
            </div>
            <ViewerInspector
                current_time={viewer_state.playback.current_time}
                {fps}
                {duration}
                probe={viewer_state.source.probe}
                measured_fps={viewer_state.playback.measured_fps}
                rvfc_supported={viewer_state.playback.rvfc_supported}
                message={viewer_state.message}
            />
        {/if}
        {#if viewer_state.message}
            <div
                class="section"
                role="status"
            >
                <p class="text-sm text-green-800">{viewer_state.message}</p>
            </div>
        {/if}
        {#if viewer_state.error}
            <div
                class="section"
                role="alert"
            >
                <p class="text-sm text-red-800">{viewer_state.error}</p>
            </div>
        {/if}
    </div>
</div>
