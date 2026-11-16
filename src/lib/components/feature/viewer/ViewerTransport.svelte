<script lang="ts">
import { copy_text, format_viewer_summary } from "$lib/media/framecode"
import { step_frame, time_to_frame, VIEWER_FALLBACK_FPS } from "$lib/media/viewer-step"

let {
    video_el,
    fps,
    duration,
    current_time,
    disabled,
    on_fullscreen,
    loudness_text = null,
}: {
    video_el: HTMLVideoElement | HTMLAudioElement | null
    fps: number
    duration: number | null
    current_time: number | null
    disabled: boolean
    on_fullscreen: () => void
    loudness_text?: string | null
} = $props()

let paused = $state(true)
let volume_level = $state(1)
let is_muted = $state(false)

$effect(() => {
    const el = video_el
    if (!el) {
        return
    }
    const sync = () => {
        paused = el.paused
    }
    sync()
    el.addEventListener("play", sync)
    el.addEventListener("pause", sync)
    return () => {
        el.removeEventListener("play", sync)
        el.removeEventListener("pause", sync)
    }
})

$effect(() => {
    const el = video_el
    if (!el) {
        return
    }
    const sync_volume = () => {
        volume_level = el.volume
        is_muted = el.muted
    }
    sync_volume()
    el.addEventListener("volumechange", sync_volume)
    return () => {
        el.removeEventListener("volumechange", sync_volume)
    }
})

let slider_max = $derived(duration ?? 0)
let slider_value = $derived(current_time ?? 0)
let controls_disabled = $derived(disabled || !video_el)
let readout = $derived(
    current_time === null || duration === null
        ? "—"
        : `${current_time.toFixed(2)} s (frame ${time_to_frame(current_time, fps)}) of ${duration.toFixed(1)} s`,
)

let copied: string | null = $state(null)

const frame_index = $derived(current_time === null ? null : time_to_frame(current_time, fps))

async function copy_kind(kind: "seconds" | "frames" | "both"): Promise<void> {
    if (current_time === null) {
        return
    }
    if (kind !== "seconds" && frame_index === null) {
        return
    }
    const text =
        kind === "seconds"
            ? current_time.toFixed(3)
            : kind === "frames"
              ? `${frame_index}`
              : format_viewer_summary(current_time, fps, duration)
    copied = (await copy_text(text)) ? kind : "failed"
}

function step(delta_frames: number) {
    if (!video_el) {
        return
    }
    video_el.pause()
    video_el.currentTime = step_frame(video_el.currentTime, fps, delta_frames, duration)
}

function seek_seconds(delta: number) {
    if (!video_el) {
        return
    }
    const target = video_el.currentTime + delta
    video_el.currentTime = duration == null ? Math.max(0, target) : Math.min(Math.max(0, target), duration)
}

function toggle_play() {
    if (!video_el) {
        return
    }
    if (video_el.paused) {
        void video_el.play()
    } else {
        video_el.pause()
    }
}

function toggle_mute() {
    if (!video_el) {
        return
    }
    video_el.muted = !video_el.muted
}
</script>

<div class="flex w-full flex-col gap-1">
    <p
        role="status"
        class="text-xs text-gray-700"
    >
        {readout}
    </p>
    {#if loudness_text}
        <p
            role="status"
            class="text-xs text-gray-500"
        >
            {loudness_text}
        </p>
    {/if}
    <div class="flex flex-wrap gap-1">
        <button
            type="button"
            onclick={() => copy_kind("seconds")}
            disabled={current_time === null}
            class="btn btn-secondary btn-sm"
        >
            Copy seconds
        </button>
        <button
            type="button"
            onclick={() => copy_kind("frames")}
            disabled={frame_index === null}
            class="btn btn-secondary btn-sm"
        >
            Copy frames
        </button>
        <button
            type="button"
            onclick={() => copy_kind("both")}
            disabled={frame_index === null}
            class="btn btn-secondary btn-sm"
        >
            Copy both
        </button>
        {#if copied === "failed"}
            <span
                role="status"
                class="self-center text-sm text-red-600"
                >Copy failed</span
            >
        {:else if copied !== null}
            <span
                role="status"
                class="self-center text-sm text-green-700"
                >Copied {copied}</span
            >
        {/if}
    </div>
    <div class="flex items-center gap-1">
        <input
            type="range"
            min="0"
            max={slider_max}
            step={1 / fps}
            value={slider_value}
            disabled={disabled || duration == null}
            aria-label="Seek"
            class="w-full flex-1"
            oninput={(e) => {
                if (video_el) {
                    video_el.currentTime = Number(e.currentTarget.value)
                }
            }}
        >
        <span
            class="shrink-0 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
            title={fps === VIEWER_FALLBACK_FPS ? "Frame rate unknown, using fallback" : "Frames per second"}
        >
            {fps}fps
            {#if fps === VIEWER_FALLBACK_FPS}
                fallback
            {/if}
        </span>
    </div>
    <div class="flex flex-wrap items-center gap-1">
        <button
            type="button"
            onclick={() => step(-10)}
            disabled={controls_disabled}
            aria-label="Step back 10 frames"
            class="btn btn-secondary btn-sm"
        >
            −10f
        </button>
        <button
            type="button"
            onclick={() => step(-1)}
            disabled={controls_disabled}
            aria-label="Step back 1 frame"
            class="btn btn-secondary btn-sm"
        >
            −1f
        </button>
        <button
            type="button"
            onclick={toggle_play}
            disabled={controls_disabled}
            aria-label={paused ? "Play" : "Pause"}
            class="btn btn-primary btn-sm"
        >
            {paused ? "▶" : "⏸"}
        </button>
        <button
            type="button"
            onclick={() => step(1)}
            disabled={controls_disabled}
            aria-label="Step forward 1 frame"
            class="btn btn-secondary btn-sm"
        >
            +1f
        </button>
        <button
            type="button"
            onclick={() => step(10)}
            disabled={controls_disabled}
            aria-label="Step forward 10 frames"
            class="btn btn-secondary btn-sm"
        >
            +10f
        </button>
        <button
            type="button"
            onclick={() => seek_seconds(-1)}
            disabled={controls_disabled}
            aria-label="Back 1 second"
            title="Shortcut: j"
            class="btn btn-secondary btn-sm"
        >
            −1s
        </button>
        <button
            type="button"
            onclick={() => seek_seconds(1)}
            disabled={controls_disabled}
            aria-label="Forward 1 second"
            title="Shortcut: l"
            class="btn btn-secondary btn-sm"
        >
            +1s
        </button>
        <button
            type="button"
            onclick={toggle_mute}
            disabled={controls_disabled}
            aria-label={is_muted ? "Unmute" : "Mute"}
            title="Shortcut: m"
            class="btn btn-secondary btn-sm"
        >
            {is_muted ? "🔇" : "🔊"}
        </button>
        <button
            type="button"
            onclick={on_fullscreen}
            disabled={controls_disabled}
            aria-label="Fullscreen"
            title="Shortcut: f"
            class="btn btn-secondary btn-sm"
        >
            ⛶
        </button>
    </div>
    <div class="flex items-center gap-1">
        <label
            for="viewer-volume"
            class="form-label shrink-0"
            >Volume</label
        >
        <input
            id="viewer-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            aria-label="Volume"
            value={volume_level}
            disabled={controls_disabled}
            class="w-full flex-1"
            oninput={(e) => {
                const next = Number(e.currentTarget.value)
                if (video_el) {
                    video_el.volume = next
                    if (next > 0) {
                        video_el.muted = false
                    }
                }
            }}
        >
    </div>
</div>
