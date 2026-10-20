<script lang="ts">
import { validate_range } from "$lib/media/timecode"

let {
    start_str,
    end_str,
    has_source = false,
    on_change,
    on_use_current,
    current_time_str = null,
    can_use_current = false,
}: {
    start_str: string
    end_str: string
    has_source?: boolean
    on_change?: (start: string, end: string) => void
    on_use_current?: (target: "start" | "end") => void
    current_time_str?: string | null
    can_use_current?: boolean
} = $props()

let start_touched = $state(false)
let end_touched = $state(false)

let validation = $derived(validate_range(start_str, end_str))
let start_error = $derived(start_touched || has_source ? validation.start_error : null)
let end_error = $derived(end_touched || has_source ? validation.end_error : null)
let range_error = $derived.by(() => {
    if (!(start_touched || end_touched || has_source)) {
        return null
    }
    if (validation.start_error || validation.end_error) {
        return null
    }
    return validation.range_error
})
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <div class="flex w-full flex-row justify-between gap-4">
        <div class="flex flex-1 flex-col gap-1">
            <label
                for="clip-v2-start"
                class="text-sm font-medium"
                >Start Time (HH:MM:SS.mmm)</label
            >
            <div class="flex items-center gap-2">
                <input
                    id="clip-v2-start"
                    type="text"
                    value={start_str}
                    oninput={(e) => {
                        start_touched = true
                        on_change?.(e.currentTarget.value, end_str)
                    }}
                    placeholder="00:00.000 or 00:00:00.000"
                    class="w-full flex-1 rounded border border-gray-300 px-3 py-2"
                >
                <button
                    type="button"
                    onclick={() => {
                        start_touched = true
                        on_use_current?.("start")
                    }}
                    disabled={!can_use_current}
                    title={current_time_str
                        ? `Copy current playback position ${current_time_str} to start`
                        : "Play the preview first to capture its position."}
                    aria-label="Use current playback position as start time"
                    class="btn btn-primary btn-sm shrink-0 whitespace-nowrap px-2 py-2 text-xs"
                >
                    ◉ Now
                </button>
            </div>
            {#if start_error}
                <p class="text-sm text-red-700">{start_error}</p>
            {/if}
        </div>
        <div class="flex flex-1 flex-col gap-1">
            <label
                for="clip-v2-end"
                class="text-sm font-medium"
                >End Time (HH:MM:SS.mmm)</label
            >
            <div class="flex items-center gap-2">
                <input
                    id="clip-v2-end"
                    type="text"
                    value={end_str}
                    oninput={(e) => {
                        end_touched = true
                        on_change?.(start_str, e.currentTarget.value)
                    }}
                    placeholder="00:00.000 or 00:00:00.000"
                    class="w-full flex-1 rounded border border-gray-300 px-3 py-2"
                >
                <button
                    type="button"
                    onclick={() => {
                        end_touched = true
                        on_use_current?.("end")
                    }}
                    disabled={!can_use_current}
                    title={current_time_str
                        ? `Copy current playback position ${current_time_str} to end`
                        : "Play the preview first to capture its position."}
                    aria-label="Use current playback position as end time"
                    class="btn btn-primary btn-sm shrink-0 whitespace-nowrap px-2 py-2 text-xs"
                >
                    ◉ Now
                </button>
            </div>
            {#if end_error}
                <p class="text-sm text-red-700">{end_error}</p>
            {/if}
        </div>
    </div>
    {#if range_error}
        <p class="w-full text-center text-sm text-red-600">{range_error}</p>
    {/if}
</div>
