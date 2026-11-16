<script lang="ts">
import { phase_at, type TransitionEasing } from "$lib/media/transition-utils"

let {
    url_a,
    url_b,
    total_duration,
    start_a,
    blend_duration,
    easing,
}: {
    url_a: string
    url_b: string
    total_duration: number
    start_a: number
    blend_duration: number
    easing: TransitionEasing
} = $props()

let time = $state(0)
let video_a: HTMLVideoElement | null = $state(null)
let video_b: HTMLVideoElement | null = $state(null)
let phase = $derived(phase_at(time, start_a, blend_duration, total_duration, easing))
let opacity_b = $derived(phase.alpha)
let phase_label = $derived(
    phase.phase === "solo-a"
        ? "Pre-roll — source A"
        : phase.phase === "blend"
          ? "Overlap — crossfade"
          : "Post-roll — source B",
)

function handle_scrub(value: number) {
    time = value
    if (video_a) {
        video_a.currentTime = value
    }
    if (video_b) {
        video_b.currentTime = Math.max(0, value - start_a)
    }
}

$effect(() => {
    if (time > total_duration) {
        time = total_duration
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
    <p class="text-sm text-gray-500">{phase_label}</p>
    <label
        for="transition-scrub"
        class="form-label"
    >
        Scrub timeline ({time.toFixed(2)}s / {total_duration.toFixed(2)}s)
    </label>
    <input
        id="transition-scrub"
        type="range"
        min={0}
        max={total_duration}
        step={0.01}
        value={time}
        oninput={(event) => handle_scrub(event.currentTarget.valueAsNumber)}
        aria-valuetext={`${time.toFixed(2)} seconds of ${total_duration.toFixed(2)}`}
    >
</div>
