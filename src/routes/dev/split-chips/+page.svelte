<script lang="ts">
import { onDestroy } from "svelte"
import { format_srt_timestamp, parse_srt, type SubtitleCue, validate_srt } from "$lib/media/compose-subtitles"
import {
    apply_split,
    build_split_srt,
    recommend_split,
    SAMPLE_SRT,
    tokenize_whitespace,
} from "$lib/media/split-prototype"

const MAX_CHARS = 42

let cues: SubtitleCue[] = $state(parse_srt(SAMPLE_SRT))
let split_points = $state(new Map<number, number>())
let download_url: string | null = $state(null)

let long_cues = $derived(cues.filter((cue) => cue.text.length > MAX_CHARS))
let output_srt = $derived(build_split_srt(cues, split_points))
let validation = $derived(validate_srt(output_srt))

function split_mid(cue: SubtitleCue, parts: string[]): number {
    const total = parts[0].length + parts[1].length
    if (total === 0) {
        return cue.start
    }
    return cue.start + ((cue.end - cue.start) * parts[0].length) / total
}

function choose_split(cue_index: number, at: number): void {
    const next = new Map(split_points)
    next.set(cue_index, at)
    split_points = next
}

function accept_all(): void {
    const next = new Map(split_points)
    for (const cue of long_cues) {
        next.set(cue.index, recommend_split(tokenize_whitespace(cue.text)))
    }
    split_points = next
}

function download_srt(): void {
    if (download_url) {
        URL.revokeObjectURL(download_url)
    }
    const blob = new Blob([output_srt], { type: "text/plain;charset=utf-8" })
    download_url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = download_url
    anchor.download = "split.srt"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
}

onDestroy(() => {
    if (download_url) {
        URL.revokeObjectURL(download_url)
    }
})
</script>

<div class="mx-auto max-w-3xl space-y-6 p-6">
    <div>
        <h1 class="text-2xl font-bold">Click-word split chips</h1>
        <p class="mt-1 text-sm text-gray-600">
            Prototype: click the word where line two should start. Times split proportionally by character count.
        </p>
    </div>

    <div class="section flex flex-wrap gap-2">
        <button
            class="btn btn-secondary btn-sm"
            onclick={accept_all}
        >
            Accept all recommended
        </button>
        <button
            class="btn btn-primary btn-sm"
            onclick={download_srt}
        >
            Download SRT
        </button>
        {#if !validation.valid}
            <p class="w-full text-sm text-red-600">{validation.errors.length} output issue(s)</p>
        {/if}
    </div>

    {#each long_cues as cue (cue.index)}
        {@const words = tokenize_whitespace(cue.text)}
        {@const recommended = recommend_split(words)}
        {@const split_at = split_points.get(cue.index) ?? recommended}
        {@const parts = apply_split(cue.text, split_at)}
        {@const mid = split_mid(cue, parts)}
        <div class="section space-y-3">
            <p class="form-label">Cue {cue.index} · {cue.text.length} chars · split before word {recommended + 1}</p>
            <div class="flex flex-wrap gap-1">
                {#each words as word, i (i)}
                    <button
                        class="btn btn-sm {i === split_at ? 'btn-primary' : 'btn-secondary'}"
                        onclick={() => choose_split(cue.index, i)}
                        disabled={i === 0}
                        title={i === 0 ? "Line two cannot start here" : `Start line two at "${word}"`}
                    >
                        {word}
                    </button>
                {/each}
            </div>
            <div class="rounded bg-gray-50 p-2 text-sm">
                <p>{format_srt_timestamp(cue.start)} --&gt; {format_srt_timestamp(mid)}</p>
                <p class="font-medium">{parts[0]}</p>
                <p>{format_srt_timestamp(mid)} --&gt; {format_srt_timestamp(cue.end)}</p>
                <p class="font-medium">{parts[1]}</p>
            </div>
        </div>
    {/each}

    <a
        class="text-sm text-blue-600 underline"
        href="/dev/split"
        >Back to split prototype</a
    >
</div>
