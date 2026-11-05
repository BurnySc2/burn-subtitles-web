<script lang="ts">
import { onDestroy } from "svelte"
import {
    format_srt_timestamp,
    parse_srt,
    type SubtitleCue,
    SubtitleError,
    validate_srt,
} from "$lib/media/compose-subtitles"
import { CUE_LOCALES, preview_parts, SAMPLE_LOCALES, SAMPLE_SRT, type TabKind } from "$lib/media/split-prototype"
import { clamp_gap, DEFAULT_GAP_MS, split_times } from "$lib/media/split-timing"
import { cps, is_long, truncate } from "$lib/media/split-triage-helpers"

const TABS: Array<{ kind: TabKind; label: string }> = [
    { kind: "recommended", label: "Recommended" },
    { kind: "alternative", label: "Alternative" },
    { kind: "custom", label: "Custom" },
]
const initial_cues = parse_srt(SAMPLE_SRT)
let cues = $state<SubtitleCue[]>(initial_cues)
let file_name = $state("Sample subtitles")
let upload_error = $state("")
let selected_tab = $state<Record<number, TabKind>>({})
let custom_text = $state<Record<number, string>>({})
let custom_parts = $state<Record<number, string[]>>({})
let custom_error = $state<Record<number, string>>({})
let included = $state<Set<number>>(new Set())
let cue_locale = $state<Record<number, string>>({ ...CUE_LOCALES })
let result_url = $state<string | null>(null)
let gap_ms = $state<number>(DEFAULT_GAP_MS)
let char_threshold = $state(80)
let step = $state<1 | 2>(1)
let selected_cues = $derived(cues.filter((cue) => included.has(cue.index)))
let progress = $derived(`${included.size} selected`)
const tab_of = (index: number): TabKind => selected_tab[index] ?? "recommended"
async function handle_srt_upload(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
        return
    }
    if (!/\.srt$/i.test(file.name)) {
        upload_error = `Only .srt files are supported (got ${file.name})`
        input.value = ""
        return
    }
    try {
        const text = await file.text()
        const validation = validate_srt(text)
        if (!validation.valid) {
            upload_error = validation.errors.join("\n")
            return
        }
        const next = parse_srt(text)
        cues = next
        selected_tab = {}
        custom_text = {}
        custom_parts = {}
        custom_error = {}
        included = new Set()
        cue_locale = Object.fromEntries(next.map((cue) => [cue.index, CUE_LOCALES[cue.index] ?? "en"]))
        file_name = file.name
        upload_error = ""
        step = 1
    } catch (error) {
        upload_error = error instanceof SubtitleError ? error.message : `Could not read ${file.name}`
    } finally {
        input.value = ""
    }
}
function toggle_cue(index: number) {
    const next = new Set(included)
    if (next.has(index)) {
        next.delete(index)
    } else {
        next.add(index)
    }
    included = next
}
function remove_cue(index: number) {
    const next = new Set(included)
    next.delete(index)
    included = next
}
function select_all_long() {
    const next = new Set(included)
    for (const cue of cues) {
        if (is_long(cue, char_threshold)) {
            next.add(cue.index)
        }
    }
    included = next
}
function clear_selection() {
    included = new Set()
}
function preview_for(cue: SubtitleCue): string[] {
    if (!included.has(cue.index)) {
        return [cue.text]
    }
    return preview_parts(cue, tab_of(cue.index), custom_parts[cue.index], cue_locale[cue.index] ?? "en")
}
let gap_safe = $derived(clamp_gap(gap_ms))
let gap_example = $derived.by(() => {
    const first = selected_cues[0]
    const start = first?.start ?? 1.0
    const end = first?.end ?? 4.0
    let ratio = 0.5
    if (first) {
        const parts = preview_for(first)
        const total = parts[0].length + (parts.length > 1 ? parts[1].length : 0)
        ratio = total === 0 ? 0.5 : parts[0].length / total
    }
    const { end_a, start_b } = split_times(start, end, ratio, gap_safe)
    if (end_a === start_b) {
        return "Too big for short cues — those stay unsplit."
    }
    return `e.g. Part 1 ends ${format_srt_timestamp(end_a)} → ${gap_safe} ms pause → Part 2 starts ${format_srt_timestamp(start_b)}`
})
function parse_custom(raw: string): string[] | null {
    const chunks = raw.includes("//") ? raw.split("//") : raw.split(/\n\s*\n/)
    const parts = chunks.map((part) => part.trim()).filter((part) => part !== "")
    return parts.length === 2 ? parts : null
}
function apply_custom(cue: SubtitleCue) {
    const parsed = parse_custom(custom_text[cue.index] ?? "")
    if (!parsed) {
        custom_error[cue.index] = "Write two parts separated by a blank line or //"
        return
    }
    custom_error[cue.index] = ""
    custom_parts[cue.index] = parsed
    selected_tab[cue.index] = "custom"
}
function reset_cue(cue: SubtitleCue) {
    selected_tab[cue.index] = "recommended"
    custom_text[cue.index] = ""
    custom_error[cue.index] = ""
    delete custom_parts[cue.index]
}
function build_output_srt(): string {
    const stamp = (start: number, end: number) => `${format_srt_timestamp(start)} --> ${format_srt_timestamp(end)}`
    const out: string[] = []
    for (const cue of cues) {
        const parts = preview_for(cue)
        const total = parts[0].length + (parts.length > 1 ? parts[1].length : 0)
        const ratio = total === 0 ? 0.5 : parts[0].length / total
        const { end_a, start_b } = split_times(cue.start, cue.end, ratio, clamp_gap(gap_ms))
        if (parts.length < 2 || end_a === start_b) {
            out.push(`${out.length + 1}\n${stamp(cue.start, cue.end)}\n${cue.text}`)
        } else {
            out.push(`${out.length + 1}\n${stamp(cue.start, end_a)}\n${parts[0]}`)
            out.push(`${out.length + 1}\n${stamp(start_b, cue.end)}\n${parts[1]}`)
        }
    }
    return out.length === 0 ? "" : `${out.join("\n\n")}\n`
}
function download_splits() {
    if (result_url) {
        URL.revokeObjectURL(result_url)
    }
    result_url = URL.createObjectURL(new Blob([build_output_srt()], { type: "text/plain;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = result_url
    link.download = "split.srt"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
onDestroy(() => result_url && URL.revokeObjectURL(result_url))
</script>

<div class="mx-auto max-w-5xl p-6">
    <h1 class="mt-2 text-2xl font-bold">Split Subtitles</h1>
    <p class="mt-1 text-sm text-gray-600">Pick a split per cue, then accept and download.</p>
    <ol class="mt-3 flex items-center gap-2 text-sm">
        <li
            aria-current={step === 1 ? "step" : undefined}
            class={step === 1 ? "font-semibold" : "text-gray-500"}
        >
            1 Select
        </li>
        <li
            aria-hidden="true"
            class="text-gray-400"
        >
            →
        </li>
        <li
            aria-current={step === 2 ? "step" : undefined}
            class={step === 2 ? "font-semibold" : "text-gray-500"}
        >
            2 Review
        </li>
    </ol>
    <div class="mt-3 flex flex-wrap items-center gap-2">
        <label
            for="gap-ms"
            class="text-sm"
        >
            Pause between parts (ms)
        </label>
        <input
            id="gap-ms"
            type="number"
            min="0"
            max="500"
            step="1"
            bind:value={gap_ms}
            inputmode="numeric"
            aria-describedby="gap-hint gap-example"
            class="w-20 rounded border p-1"
        >
        <p
            id="gap-hint"
            class="w-full text-xs text-gray-500"
        >
            Brief blank between the two halves so they don't overlap. 10 ms ≈ 1/100 s — not noticeable.
        </p>
        <p
            id="gap-example"
            class="w-full text-xs text-gray-500"
        >
            {gap_example}
        </p>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
        <label class="text-sm">
            Subtitles file
            <input
                type="file"
                accept=".srt"
                onchange={handle_srt_upload}
                class="ml-2 text-sm"
            >
        </label>
        <span class="text-xs text-gray-500">{file_name} · {cues.length} cues</span>
    </div>
    {#if upload_error}
        <p
            role="alert"
            class="mt-2 whitespace-pre-line text-sm text-red-600"
        >
            {upload_error}
        </p>
    {/if}
    {#if step === 1}
        <div class="mt-4 flex flex-wrap items-center gap-2">
            <label class="text-sm">
                Long over (chars)
                <input
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    bind:value={char_threshold}
                    class="w-20 rounded border p-1"
                >
            </label>
            <button
                class="btn btn-secondary btn-sm"
                onclick={select_all_long}
            >
                Select all long
            </button>
            <button
                class="btn btn-sm"
                onclick={clear_selection}
            >
                Clear
            </button>
            <span class="ml-auto text-xs text-gray-500">{progress}</span>
        </div>
        <ul class="mt-3 divide-y rounded border">
            {#each cues as cue (cue.index)}
                {@const rate = cps(cue)}
                {@const hot = rate > 17}
                <li>
                    <label class="flex cursor-pointer items-center gap-3 p-2 hover:bg-gray-50">
                        <input
                            type="checkbox"
                            checked={included.has(cue.index)}
                            onchange={() => toggle_cue(cue.index)}
                        >
                        <span class="w-10 shrink-0 text-sm font-semibold">#{cue.index}</span>
                        <span class="w-44 shrink-0 text-xs text-gray-500">
                            {format_srt_timestamp(cue.start)}
                            --> {format_srt_timestamp(cue.end)}
                        </span>
                        <span
                            class="shrink-0 rounded px-1.5 py-0.5 text-xs {hot
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-800'}"
                        >
                            {rate.toFixed(1)}
                            cps
                            {#if rate > 20}
                                ⚠
                            {/if}
                        </span>
                        <span class="w-16 shrink-0 text-xs text-gray-500"> {Array.from(cue.text).length} chars </span>
                        <span
                            class="min-w-0 flex-1 truncate text-sm"
                            dir="auto"
                            title={cue.text}
                        >
                            {truncate(cue.text, 80)}
                        </span>
                    </label>
                </li>
            {/each}
        </ul>
        <div class="sticky bottom-0 mt-6 border-t bg-white p-4">
            <button
                class="btn btn-primary w-full"
                disabled={included.size === 0}
                onclick={() => { step = 2 }}
            >
                Continue with {included.size} selected →
            </button>
        </div>
    {:else}
        <div class="mt-4">
            <button
                class="btn btn-secondary btn-sm"
                onclick={() => { step = 1 }}
            >
                ← Back to select
            </button>
        </div>
        {#if selected_cues.length > 0}
            <ul class="mt-3 flex flex-wrap gap-2">
                {#each selected_cues as cue (cue.index)}
                    <li class="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs">
                        <span>#{cue.index}</span>
                        <button
                            aria-label="Remove cue {cue.index}"
                            class="rounded-full px-1 hover:bg-gray-200"
                            onclick={() => remove_cue(cue.index)}
                        >
                            ×
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
        {#if selected_cues.length === 0}
            <p class="section mt-6 text-sm text-gray-600">No cues selected. Go back to select cues to split.</p>
        {/if}
        {#each selected_cues as cue (cue.index)}
            {@const tab = tab_of(cue.index)}
            {@const preview = preview_for(cue)}
            <section
                class="section mt-3"
                style="padding: 0.75rem"
            >
                <div class="flex flex-wrap items-center gap-2">
                    <h2 class="text-base font-semibold">Cue #{cue.index}</h2>
                    <span class="text-xs text-gray-500">
                        {format_srt_timestamp(cue.start)}
                        --> {format_srt_timestamp(cue.end)}
                    </span>
                    <select
                        class="ml-auto rounded border p-1 text-sm"
                        aria-label="Locale for cue {cue.index}"
                        bind:value={cue_locale[cue.index]}
                    >
                        {#each SAMPLE_LOCALES as locale (locale)}
                            <option value={locale}>{locale}</option>
                        {/each}
                    </select>
                    <button
                        class="btn btn-sm"
                        onclick={() => reset_cue(cue)}
                    >
                        Reset
                    </button>
                </div>
                <div
                    role="tablist"
                    aria-label="Split options for cue {cue.index}"
                    class="mt-2 flex gap-1.5"
                >
                    {#each TABS as option (option.kind)}
                        <button
                            role="tab"
                            aria-selected={tab === option.kind}
                            class="btn btn-sm {tab === option.kind ? 'btn-primary' : 'btn-secondary'}"
                            onclick={() => { selected_tab[cue.index] = option.kind }}
                        >
                            {option.label}
                        </button>
                    {/each}
                </div>
                {#if tab === "custom"}
                    <details
                        class="mt-2 rounded border p-2"
                        open
                    >
                        <summary class="cursor-pointer text-sm text-gray-600">Custom split</summary>
                        <textarea
                            class="mt-1 w-full rounded border p-2 text-sm"
                            rows="2"
                            dir="auto"
                            placeholder="Two parts separated by a blank line or //"
                            bind:value={custom_text[cue.index]}
                        ></textarea>
                        <div class="mt-1 flex items-center gap-2">
                            <button
                                class="btn btn-secondary btn-sm"
                                onclick={() => apply_custom(cue)}
                            >
                                Apply custom
                            </button>
                            {#if custom_error[cue.index]}
                                <span class="text-sm text-red-600">{custom_error[cue.index]}</span>
                            {/if}
                        </div>
                    </details>
                {/if}
                <div
                    class="mt-2 grid items-start gap-2 text-sm md:grid-cols-2"
                    dir="auto"
                >
                    <div class="rounded bg-gray-50 p-2">
                        <p class="form-label">Old</p>
                        <p>{cue.text}</p>
                    </div>
                    <div class="rounded bg-green-50 p-2">
                        <p class="form-label">New · {tab}{preview.length > 1 ? "" : " · unchanged"}</p>
                        <p>{preview[0]}</p>
                        {#if preview[1]}
                            <p class="mt-1">{preview[1]}</p>
                        {/if}
                    </div>
                </div>
            </section>
        {/each}
        <div class="sticky bottom-0 mt-3 border-t bg-white px-2 py-2">
            <button
                class="btn btn-primary w-full"
                disabled={included.size === 0}
                onclick={download_splits}
            >
                Accept {included.size} splits -> Download
            </button>
        </div>
    {/if}
</div>
