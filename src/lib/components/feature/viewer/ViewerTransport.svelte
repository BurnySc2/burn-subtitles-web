<script lang="ts">
import { step_frame, VIEWER_FALLBACK_FPS } from "$lib/media/viewer-step"

let {
    video_el,
    fps,
    duration,
    current_time,
    disabled,
}: {
    video_el: HTMLVideoElement | HTMLAudioElement | null
    fps: number
    duration: number | null
    current_time: number | null
    disabled: boolean
} = $props()

let paused = $state(true)

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

let slider_max = $derived(duration ?? 0)
let slider_value = $derived(current_time ?? 0)
let controls_disabled = $derived(disabled || !video_el)

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
</script>

<div class="flex w-full flex-col gap-2">
    <div class="flex items-center gap-3">
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
    <div class="flex flex-wrap items-center gap-2">
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
    </div>
</div>
