<script lang="ts">
let {
    on_file,
    disabled = false,
}: {
    on_file: (file: File) => void
    disabled?: boolean
} = $props()

let file_name: string | null = $state(null)
let file_input: HTMLInputElement | null = $state(null)

function handle_pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
        return
    }
    file_name = file.name
    on_file(file)
    input.value = ""
}
</script>

<div class="drop-zone w-full">
    <input
        bind:this={file_input}
        type="file"
        accept="video/*,audio/*"
        onchange={handle_pick}
        aria-describedby="viewer-file-status"
        {disabled}
        class="w-full rounded border border-gray-300 bg-white p-2 text-transparent file:mr-4 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-white hover:file:bg-gray-800"
    >
    <div class="mt-2 flex justify-center">
        <button
            type="button"
            onclick={() => file_input?.click()}
            {disabled}
            class="btn btn-secondary btn-sm"
        >
            Choose file
        </button>
    </div>
    {#if file_name}
        <p
            id="viewer-file-status"
            aria-live="polite"
            class="mt-2 text-sm font-medium text-green-700"
        >
            ✓ Accepted: {file_name}
        </p>
    {:else}
        <p
            id="viewer-file-status"
            aria-live="polite"
            class="mt-2 text-sm text-gray-500"
        >
            No file chosen — select video or audio
        </p>
    {/if}
</div>
