<script lang="ts">
export interface DualSlot {
    file: File | null
    url: string | null
}

let {
    slot_a,
    slot_b,
    on_file,
}: {
    slot_a: DualSlot
    slot_b: DualSlot
    on_file?: (slot: "a" | "b", file: File) => void
} = $props()

function handle_input(event: Event, slot: "a" | "b") {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ""
    if (!file) {
        return
    }
    on_file?.(slot, file)
}
</script>

<div class="grid w-full gap-4 md:grid-cols-2">
    <div class="rounded-lg bg-gray-100 p-4">
        <h2 class="mb-3 text-lg font-semibold">Source A</h2>
        <input
            type="file"
            accept="video/*"
            onchange={(event) => handle_input(event, "a")}
            aria-describedby="transition-file-status-a"
            class="w-full rounded border border-gray-300 bg-white p-2 text-transparent file:mr-4 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-white hover:file:bg-gray-800"
        >
        {#if slot_a.file}
            <p
                id="transition-file-status-a"
                aria-live="polite"
                class="mt-2 text-sm font-medium text-green-700"
            >
                ✓ Accepted: {slot_a.file.name}
            </p>
        {:else}
            <p
                id="transition-file-status-a"
                aria-live="polite"
                class="mt-2 text-sm text-gray-500"
            >
                No file chosen — select video for source A
            </p>
        {/if}
    </div>
    <div class="rounded-lg bg-gray-100 p-4">
        <h2 class="mb-3 text-lg font-semibold">Source B</h2>
        <input
            type="file"
            accept="video/*"
            onchange={(event) => handle_input(event, "b")}
            aria-describedby="transition-file-status-b"
            class="w-full rounded border border-gray-300 bg-white p-2 text-transparent file:mr-4 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-white hover:file:bg-gray-800"
        >
        {#if slot_b.file}
            <p
                id="transition-file-status-b"
                aria-live="polite"
                class="mt-2 text-sm font-medium text-green-700"
            >
                ✓ Accepted: {slot_b.file.name}
            </p>
        {:else}
            <p
                id="transition-file-status-b"
                aria-live="polite"
                class="mt-2 text-sm text-gray-500"
            >
                No file chosen — select video for source B
            </p>
        {/if}
    </div>
</div>
