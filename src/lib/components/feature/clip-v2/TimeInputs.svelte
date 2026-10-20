<script lang="ts">
import { parseTimecode } from "$lib/media/timecode"

let {
    startStr,
    endStr,
    hasSource = false,
    onChange,
}: {
    startStr: string
    endStr: string
    hasSource?: boolean
    onChange?: (start: string, end: string) => void
} = $props()

let start_touched = $state(false)
let end_touched = $state(false)

function validate_one(value: string): string | null {
    try {
        parseTimecode(value)
        return null
    } catch (error) {
        return (error as Error).message
    }
}

let start_error = $derived(start_touched || hasSource ? validate_one(startStr) : null)
let end_error = $derived(end_touched || hasSource ? validate_one(endStr) : null)
let range_error = $derived.by(() => {
    if (!(start_touched || end_touched || hasSource)) {
        return null
    }
    if (start_error || end_error) {
        return null
    }
    return parseTimecode(endStr) <= parseTimecode(startStr) ? "End time must be greater than start time" : null
})
</script>

<div class="flex flex-wrap items-center gap-4 rounded-lg bg-gray-100 p-4">
    <div class="flex flex-col gap-1">
        <label
            for="clip-v2-start"
            class="text-sm font-medium"
            >Start Time (HH:MM:SS.mmm)</label
        >
        <input
            id="clip-v2-start"
            type="text"
            value={startStr}
            oninput={(e) => {
                start_touched = true
                onChange?.(e.currentTarget.value, endStr)
            }}
            onchange={() => {
                start_touched = true
            }}
            placeholder="00:00.000 or 00:00:00.000"
            class="rounded border border-gray-300 px-3 py-2"
        >
        {#if start_error}
            <p class="text-sm text-red-700">{start_error}</p>
        {/if}
    </div>
    <div class="flex flex-col gap-1">
        <label
            for="clip-v2-end"
            class="text-sm font-medium"
            >End Time (HH:MM:SS.mmm)</label
        >
        <input
            id="clip-v2-end"
            type="text"
            value={endStr}
            oninput={(e) => {
                end_touched = true
                onChange?.(startStr, e.currentTarget.value)
            }}
            onchange={() => {
                end_touched = true
            }}
            placeholder="00:00.000 or 00:00:00.000"
            class="rounded border border-gray-300 px-3 py-2"
        >
        {#if end_error}
            <p class="text-sm text-red-700">{end_error}</p>
        {/if}
    </div>
    {#if range_error}
        <p class="w-full text-sm text-red-700">{range_error}</p>
    {/if}
</div>
