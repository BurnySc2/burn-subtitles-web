<script lang="ts">
import { onDestroy } from "svelte"
import { clip_basename } from "$lib/media/clip-filename"
import {
    format_srt_timestamp,
    parse_srt,
    type SubtitleCue,
    SubtitleError,
    validate_srt,
} from "$lib/media/compose-subtitles"
import { preview_parts, SAMPLE_LOCALES, type TabKind } from "$lib/media/split-prototype"
import {
    BALANCE_PRESETS,
    type BalancePreset,
    balance_effective_ratio,
    clamp_gap,
    DEFAULT_GAP_MS,
    split_times,
} from "$lib/media/split-timing"
import { cps, is_long, truncate } from "$lib/media/split-triage-helpers"

const TABS: Array<{ kind: TabKind; label: string }> = [
    { kind: "recommended", label: "Recommended" },
    { kind: "alternative", label: "Alternative" },
    { kind: "custom", label: "Custom" },
]
let cues = $state<SubtitleCue[]>([])
let file_name = $state("")
let upload_error = $state("")
let selected_tab = $state<Record<number, TabKind>>({})
let custom_text = $state<Record<number, string>>({})
let custom_parts = $state<Record<number, string[]>>({})
let custom_error = $state<Record<number, string>>({})
let included = $state<Set<number>>(new Set())
let page_locale = $state("en")
let result_url = $state<string | null>(null)
let gap_ms = $state<number>(DEFAULT_GAP_MS)
let balance_preset = $state<BalancePreset>("proportional")
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
    return preview_parts(cue, tab_of(cue.index), custom_parts[cue.index], page_locale)
}
let gap_safe = $derived(clamp_gap(gap_ms))
let gap_example = $derived.by(() => {
    let cue = selected_cues[0]
    for (const next of selected_cues) {
        if (!cue || next.end - next.start > cue.end - cue.start) {
            cue = next
        }
    }
    let start = cue?.start ?? 1.0
    let end = cue?.end ?? 4.0
    let label = cue ? `Cue #${cue.index} ` : ""
    let ratio = 0.5
    if (cue) {
        const parts = preview_for(cue)
        const total = parts[0].length + (parts.length > 1 ? parts[1].length : 0)
        ratio = total === 0 ? 0.5 : parts[0].length / total
    }
    let r_eff = balance_effective_ratio(ratio, balance_preset)
    let times = split_times(start, end, r_eff, gap_safe)
    if (times.end_a === times.start_b) {
        start = 1.0
        end = 4.0
        label = ""
        r_eff = balance_effective_ratio(0.5, balance_preset)
        times = split_times(start, end, r_eff, gap_safe)
    }
    const preset_label = BALANCE_PRESETS.find((p) => p.id === balance_preset)?.label ?? balance_preset
    return `e.g. ${label}Part 1 ends ${format_srt_timestamp(times.end_a)} → ${gap_safe} ms pause → Part 2 starts ${format_srt_timestamp(times.start_b)} (${preset_label})`
})
function derive_custom(cue: SubtitleCue) {
    const first = (custom_text[cue.index] ?? "").trim()
    if (!first) {
        custom_error[cue.index] = ""
        delete custom_parts[cue.index]
        return
    }
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase()
    if (!normalize(cue.text).startsWith(normalize(first))) {
        custom_error[cue.index] = "Keep typing — first part must appear in the original text."
        delete custom_parts[cue.index]
        return
    }
    const rest = cue.text.trim().slice(first.length).trim()
    if (!rest || normalize(`${first} ${rest}`) !== normalize(cue.text)) {
        custom_error[cue.index] = "Keep typing — first part must appear in the original text."
        delete custom_parts[cue.index]
        return
    }
    custom_error[cue.index] = ""
    custom_parts[cue.index] = [first, rest]
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
        const r_eff = balance_effective_ratio(ratio, balance_preset)
        const { end_a, start_b } = split_times(cue.start, cue.end, r_eff, clamp_gap(gap_ms))
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
    const stem = file_name ? clip_basename(file_name) : "split"
    link.download = `${stem}_split.srt`
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
        <div class="flex items-center gap-2">
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
                class="w-20 max-w-[5rem] rounded border p-1 text-right"
            >
        </div>
        <p
            id="gap-hint"
            class="w-full text-xs text-gray-500"
        >
            Brief blank between the two halves so they don't overlap.
        </p>
        <p
            id="gap-example"
            class="w-full text-xs text-gray-500"
        >
            {gap_example}
        </p>
        <label
            for="balance-preset"
            class="text-sm"
        >
            Timing balance
            <select
                id="balance-preset"
                bind:value={balance_preset}
                aria-describedby="balance-hint"
                class="ml-2 rounded border p-1 text-sm"
            >
                {#each BALANCE_PRESETS as p (p.id)}
                    <option value={p.id}>{p.label}</option>
                {/each}
            </select>
        </label>
        <p
            id="balance-hint"
            class="w-full text-xs text-gray-500"
        >
            Equal = both halves same time. Proportional = time matches text length (default). Boost = longer half gets
            extra time.
        </p>
        <label
            for="page-locale"
            class="text-sm"
        >
            Language
        </label>
        <select
            id="page-locale"
            bind:value={page_locale}
            aria-describedby="locale-hint"
            class="rounded border p-1 text-sm"
        >
            {#each SAMPLE_LOCALES as locale (locale)}
                <option value={locale}>{locale}</option>
            {/each}
        </select>
        <p
            id="locale-hint"
            class="w-full text-xs text-gray-500"
        >
            Tokenizer language for all cues.
        </p>
    </div>
    <hr class="my-4 border-t border-gray-200">
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
        {#if cues.length === 0}
            <span class="text-xs text-gray-500">No file loaded</span>
        {:else}
            <span class="text-xs text-gray-500">{file_name} · {cues.length} cues</span>
        {/if}
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
        {#if cues.length === 0}
            <p class="section mt-4 text-sm text-gray-600">
                Upload an .srt file to begin — your cues will appear here for triage.
            </p>
        {:else}
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
                                    <span
                                        aria-label="reading speed warning: over 20 characters per second"
                                        title="Over 20 characters per second — hard to read"
                                    >
                                        ⚠
                                    </span>
                                {/if}
                            </span>
                            <span class="w-16 shrink-0 text-xs text-gray-500">
                                {Array.from(cue.text).length}
                                chars
                            </span>
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
        {/if}
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
                    <button
                        class="btn btn-sm ml-auto"
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
                            aria-controls="cue-preview-{cue.index}"
                            class="btn btn-sm {tab === option.kind ? 'btn-primary' : 'btn-secondary'}"
                            onclick={() => { selected_tab[cue.index] = option.kind }}
                        >
                            {option.label}
                        </button>
                    {/each}
                </div>
                {#if tab === "custom"}
                    <div class="mt-2 rounded border p-2">
                        <label
                            for="custom-first-{cue.index}"
                            class="form-label"
                        >
                            First part
                        </label>
                        <input
                            id="custom-first-{cue.index}"
                            type="text"
                            class="mt-1 w-full rounded border p-2 text-sm"
                            dir="auto"
                            placeholder="First part, rest becomes Part 2"
                            bind:value={custom_text[cue.index]}
                            oninput={() => derive_custom(cue)}
                            aria-describedby={custom_error[cue.index]
                                ? `custom-error-${cue.index}`
                                : undefined}
                        >
                        {#if custom_error[cue.index]}
                            <p
                                id="custom-error-{cue.index}"
                                role="alert"
                                class="mt-1 text-xs text-red-600"
                            >
                                {custom_error[cue.index]}
                            </p>
                        {/if}
                    </div>
                {/if}
                <div
                    id="cue-preview-{cue.index}"
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
