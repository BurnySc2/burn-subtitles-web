<script lang="ts">
import type { LoudnessCache } from "$lib/media/viewer-loudness"
import type { LoudnessStatus } from "$lib/media/viewer-state.svelte"

interface Props {
    status: LoudnessStatus
    cache: LoudnessCache | null
    progress: number
    has_file: boolean
    on_analyze: () => void
    on_cancel: () => void
}

let { status, cache, progress, has_file, on_analyze, on_cancel }: Props = $props()

let bars_canvas: HTMLCanvasElement | null = $state(null)

let clamped_progress = $derived(
    typeof progress !== "number" || !Number.isFinite(progress) ? 0 : Math.min(1, Math.max(0, progress)),
)
let percent = $derived(Math.round(clamped_progress * 100))
let is_analyzing = $derived(status === "analyzing")
let analyze_disabled = $derived(!has_file || is_analyzing)

function format_dbfs(value: number): string {
    if (!(value > 0) || !Number.isFinite(value)) {
        return "-∞"
    }
    return `${(20 * Math.log10(value)).toFixed(1)}`
}

let readout = $derived.by(() => {
    if (is_analyzing) {
        return `Analyzing loudness… ${percent}%`
    }
    if (status === "failed") {
        return "Loudness analysis failed — no audio track or unreadable audio."
    }
    if (cache) {
        return `Peak ${format_dbfs(cache.peak_overall)} dBFS · RMS ${format_dbfs(cache.rms_overall)} dBFS`
    }
    return has_file ? "No loudness data — analyze to preview levels." : "Choose a file to analyze loudness."
})

$effect(() => {
    const canvas = bars_canvas
    const data = cache
    if (!canvas || !data) {
        return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) {
        return
    }
    const width = canvas.width
    const height = canvas.height
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#e5e7eb"
    ctx.fillRect(0, 0, width, height)
    const total = data.peaks.length
    if (total === 0) {
        return
    }
    const bars = Math.min(total, width)
    const bar_width = width / bars
    ctx.fillStyle = "#374151"
    for (let i = 0; i < bars; i += 1) {
        const index = Math.min(total - 1, Math.floor((i * total) / bars))
        const peak = data.peaks[index] ?? 0
        const safe = typeof peak === "number" && Number.isFinite(peak) ? Math.min(1, Math.max(0, peak)) : 0
        const bar_height = Math.max(1, Math.round(safe * height))
        ctx.fillRect(i * bar_width, height - bar_height, Math.max(1, bar_width - 0.5), bar_height)
    }
})
</script>

<div class="section">
    <h2 class="section-title">Loudness</h2>
    <p
        role="status"
        class="mt-1 text-sm text-gray-500"
    >
        {readout}
    </p>
    {#if is_analyzing}
        <div
            role="progressbar"
            aria-label="Loudness analysis progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            class="mt-2 h-2 w-full overflow-hidden rounded bg-gray-200"
        >
            <div
                class="h-full rounded bg-gray-700"
                style={`width: ${percent}%`}
            ></div>
        </div>
    {/if}
    {#if cache}
        <canvas
            bind:this={bars_canvas}
            width={240}
            height={48}
            aria-hidden="true"
            class="mt-2 h-12 w-full rounded bg-gray-200"
        ></canvas>
    {/if}
    <div class="mt-2 flex flex-wrap gap-1">
        <button
            type="button"
            onclick={on_analyze}
            disabled={analyze_disabled}
            aria-label={has_file ? "Analyze loudness" : "Analyze loudness (no file chosen)"}
            class="btn btn-primary btn-sm"
        >
            Analyze
        </button>
        <button
            type="button"
            onclick={on_cancel}
            disabled={!is_analyzing}
            aria-label="Cancel loudness analysis"
            class="btn btn-secondary btn-sm"
        >
            Cancel
        </button>
    </div>
</div>
