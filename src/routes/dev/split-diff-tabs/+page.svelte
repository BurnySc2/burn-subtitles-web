<script lang="ts">
import { onDestroy } from "svelte"
import { format_srt_timestamp, parse_srt, type SubtitleCue } from "$lib/media/compose-subtitles"
import { CUE_LOCALES, preview_parts, SAMPLE_LOCALES, SAMPLE_SRT, type TabKind } from "$lib/media/split-prototype"

const TABS: Array<{ kind: TabKind; label: string }> = [
    { kind: "recommended", label: "Recommended" },
    { kind: "alternative", label: "Alternative" },
    { kind: "custom", label: "Custom" },
]
const cues: SubtitleCue[] = parse_srt(SAMPLE_SRT)
let selected_tab = $state<Record<number, TabKind>>({})
let custom_text = $state<Record<number, string>>({})
let custom_parts = $state<Record<number, string[]>>({})
let custom_error = $state<Record<number, string>>({})
let included = $state<Record<number, boolean>>(Object.fromEntries(cues.map((cue) => [cue.index, true])))
let cue_locale = $state<Record<number, string>>({ ...CUE_LOCALES })
let result_url = $state<string | null>(null)
let included_count = $derived(cues.filter((cue) => included[cue.index] !== false).length)
function tab_of(index: number): TabKind {
    return selected_tab[index] ?? "recommended"
}
function preview_for(cue: SubtitleCue): string[] {
    if (included[cue.index] === false) {
        return [cue.text]
    }
    return preview_parts(cue, tab_of(cue.index), custom_parts[cue.index], cue_locale[cue.index] ?? "en")
}
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
        if (included[cue.index] === false) {
            out.push(`${out.length + 1}\n${stamp(cue.start, cue.end)}\n${cue.text}`)
            continue
        }
        const parts = preview_for(cue)
        if (parts.length < 2) {
            out.push(`${out.length + 1}\n${stamp(cue.start, cue.end)}\n${cue.text}`)
            continue
        }
        const chars = parts[0].length + parts[1].length
        const mid = chars === 0 ? cue.start : cue.start + ((cue.end - cue.start) * parts[0].length) / chars
        out.push(`${out.length + 1}\n${stamp(cue.start, mid)}\n${parts[0]}`)
        out.push(`${out.length + 1}\n${stamp(mid, cue.end)}\n${parts[1]}`)
    }
    return out.length === 0 ? "" : `${out.join("\n\n")}\n`
}
function download_splits() {
    const blob = new Blob([build_output_srt()], { type: "text/plain;charset=utf-8" })
    if (result_url) {
        URL.revokeObjectURL(result_url)
    }
    result_url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = result_url
    link.download = "split-prototype.srt"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
onDestroy(() => {
    if (result_url) {
        URL.revokeObjectURL(result_url)
    }
})
</script>

<div class="mx-auto max-w-5xl p-6">
    <a
        href="/dev"
        class="text-sm text-blue-600 hover:underline"
        >← Back to /dev</a
    >
    <h1 class="mt-2 text-2xl font-bold">Split diff + option tabs</h1>
    <p class="mt-1 text-sm text-gray-600">Pick a split per cue, then accept and download.</p>
    {#each cues as cue (cue.index)}
        {@const tab = tab_of(cue.index)}
        {@const preview = preview_for(cue)}
        <section class="section mt-6">
            <div class="flex flex-wrap items-center gap-3">
                <label class="flex items-center gap-1 text-sm">
                    <input
                        type="checkbox"
                        bind:checked={included[cue.index]}
                    >
                    Include
                </label>
                <h2 class="font-semibold">Cue #{cue.index}</h2>
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
                class="mt-3 flex gap-2"
            >
                {#each TABS as option (option.kind)}
                    <button
                        role="tab"
                        aria-selected={tab === option.kind}
                        class="btn btn-sm {tab === option.kind ? 'btn-primary' : 'btn-secondary'}"
                        onclick={() => {
                            selected_tab[cue.index] = option.kind
                        }}
                    >
                        {option.label}
                    </button>
                {/each}
            </div>
            {#if tab === "custom"}
                <textarea
                    class="mt-3 w-full rounded border p-2 text-sm"
                    rows="3"
                    dir="auto"
                    placeholder="Two parts separated by a blank line or //"
                    bind:value={custom_text[cue.index]}
                ></textarea>
                <div class="mt-2 flex items-center gap-2">
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
            {/if}
            <div
                class="mt-3 grid gap-4 md:grid-cols-2"
                dir="auto"
            >
                <div class="rounded bg-gray-50 p-3">
                    <p class="form-label">Old</p>
                    <p class="text-sm">{cue.text}</p>
                    <p class="mt-1 text-xs text-gray-500">
                        {format_srt_timestamp(cue.start)}
                        --> {format_srt_timestamp(cue.end)}
                    </p>
                </div>
                <div class="rounded bg-green-50 p-3">
                    <p class="form-label">New · {tab}{preview.length > 1 ? "" : " · unchanged"}</p>
                    <p class="text-sm">{preview[0]}</p>
                    {#if preview[1]}
                        <p class="mt-2 text-sm">{preview[1]}</p>
                    {/if}
                </div>
            </div>
        </section>
    {/each}
    <div class="sticky bottom-0 mt-6 border-t bg-white p-4">
        <button
            class="btn btn-primary w-full"
            disabled={included_count === 0}
            onclick={download_splits}
        >
            Accept {included_count} splits -> Download
        </button>
    </div>
</div>
