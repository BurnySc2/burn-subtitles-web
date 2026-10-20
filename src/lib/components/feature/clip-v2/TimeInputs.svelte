<script lang="ts">
import { parse_timecode } from "$lib/media/timecode"

let {
    start_str,
    end_str,
    has_source = false,
    on_change,
}: {
    start_str: string
    end_str: string
    has_source?: boolean
    on_change?: (start: string, end: string) => void
} = $props()

let start_touched = $state(false)
let end_touched = $state(false)

function validate_one(value: string): string | null {
    try {
        parse_timecode(value)
        return null
    } catch (error) {
        return (error as Error).message
    }
}

let start_error = $derived(start_touched || has_source ? validate_one(start_str) : null)
let end_error = $derived(end_touched || has_source ? validate_one(end_str) : null)
let range_error = $derived.by(() => {
    if (!(start_touched || end_touched || has_source)) {
        return null
    }
    if (start_error || end_error) {
        return null
    }
    return parse_timecode(end_str) <= parse_timecode(start_str) ? "End time must be greater than start time" : null
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
            value={start_str}
            oninput={(e) => {
                start_touched = true
                on_change?.(e.currentTarget.value, end_str)
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
            value={end_str}
            oninput={(e) => {
                end_touched = true
                on_change?.(start_str, e.currentTarget.value)
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
