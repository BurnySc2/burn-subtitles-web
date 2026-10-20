<script lang="ts">
import { formatTimecode, parseTimecode } from "$lib/media/timecode"

let {
    startStr,
    endStr,
    duration,
    onChange,
}: {
    startStr: string
    endStr: string
    duration: number | null
    onChange?: (start: string, end: string) => void
} = $props()

function validate_one(value: string): string | null {
    try {
        parseTimecode(value)
        return null
    } catch (error) {
        return (error as Error).message
    }
}

let start_error = $derived(validate_one(startStr))
let end_error = $derived(validate_one(endStr))
let range_error = $derived.by(() => {
    if (start_error || end_error) {
        return null
    }
    return parseTimecode(endStr) <= parseTimecode(startStr) ? "End time must be greater than start time" : null
})

function handle_use_full() {
    if (duration === null) {
        return
    }
    onChange?.(formatTimecode(0), formatTimecode(duration))
}
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
            oninput={(e) => onChange?.(e.currentTarget.value, endStr)}
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
            oninput={(e) => onChange?.(startStr, e.currentTarget.value)}
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
    <button
        onclick={handle_use_full}
        disabled={duration === null}
        class="rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
    >
        Use full
    </button>
</div>
