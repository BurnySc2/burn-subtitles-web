<script lang="ts">
import { EASING_REGISTRY, type TransitionEasing } from "$lib/media/transition-utils"

let {
    url_a,
    url_b,
    duration,
    easing,
    start_a = 0,
}: {
    url_a: string
    url_b: string
    duration: number
    easing: TransitionEasing
    start_a?: number
} = $props()

let time = $state(0)
let video_a: HTMLVideoElement | null = $state(null)
let video_b: HTMLVideoElement | null = $state(null)
let progress = $derived(duration > 0 ? Math.min(Math.max(time / duration, 0), 1) : 0)
let opacity_b = $derived(EASING_REGISTRY[easing](progress))

function handle_scrub(value: number) {
    time = value
    if (video_a) {
        video_a.currentTime = start_a + value
    }
    if (video_b) {
        video_b.currentTime = value
    }
}

$effect(() => {
    if (time > duration) {
        time = duration
    }
})
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">Crossfade preview</h2>
    <div class="relative w-full overflow-hidden rounded">
        <video
            bind:this={video_a}
            src={url_a}
            muted
            playsinline
            preload="metadata"
            class="block w-full rounded"
        >
            <track kind="captions">
        </video>
        <video
            bind:this={video_b}
            src={url_b}
            muted
            playsinline
            preload="metadata"
            class="absolute inset-0 block w-full rounded"
            style:opacity={opacity_b}
        >
            <track kind="captions">
        </video>
    </div>
    <label
        for="transition-scrub"
        class="form-label"
    >
        Scrub crossfade ({time.toFixed(2)}s / {duration.toFixed(2)}s)
    </label>
    <input
        id="transition-scrub"
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={time}
        oninput={(event) => handle_scrub(event.currentTarget.valueAsNumber)}
        aria-valuetext={`${time.toFixed(2)} seconds of ${duration.toFixed(2)}`}
    >
</div>
