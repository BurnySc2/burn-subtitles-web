<script lang="ts">
import { font_registry, register_font_entry, remove_font_entry } from "$lib/media/compose-font-library"
import { load_custom_font, load_custom_font_from_url } from "$lib/utils/custom-font"

let file_input: HTMLInputElement | null = $state(null)
let url_text = $state("")
let busy = $state(false)
let error = $state<string | null>(null)

async function on_pick_file(file: File | null): Promise<void> {
    if (!file || busy) {
        return
    }
    busy = true
    error = null
    try {
        const loaded = await load_custom_font(file)
        register_font_entry({
            family: loaded.font_family,
            source: "custom-file",
            object_url: loaded.object_url,
            font_face: loaded.font_face ?? null,
            loaded_at: Date.now(),
        })
        if (file_input) {
            file_input.value = ""
        }
    } catch (caught) {
        error = caught instanceof Error ? caught.message : "Failed to load font file."
    } finally {
        busy = false
    }
}

async function on_fetch_url(): Promise<void> {
    const url = url_text.trim()
    if (!url || busy) {
        return
    }
    busy = true
    error = null
    try {
        const loaded = await load_custom_font_from_url(url)
        register_font_entry({
            family: loaded.font_family,
            source: "custom-url",
            object_url: loaded.object_url,
            font_face: loaded.font_face ?? null,
            loaded_at: Date.now(),
            origin_url: url,
        })
        url_text = ""
    } catch (caught) {
        error = caught instanceof Error ? caught.message : "Failed to fetch font URL."
    } finally {
        busy = false
    }
}

function on_remove(family: string): void {
    remove_font_entry(family)
}
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h2 class="text-lg font-semibold">Font library</h2>
    <input
        bind:this={file_input}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/*"
        onchange={(e) => {
            const file = e.currentTarget.files?.[0] ?? null
            void on_pick_file(file)
        }}
        aria-describedby="compose-font-status"
        disabled={busy}
        class="w-full rounded border border-gray-300 bg-white p-2 text-transparent file:mr-4 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-white hover:file:bg-gray-800"
    >
    <div class="flex gap-2">
        <input
            type="url"
            bind:value={url_text}
            placeholder="https://example.com/font.ttf"
            aria-label="Font URL"
            disabled={busy}
            class="min-w-0 flex-1 rounded border border-gray-300 bg-white p-2 text-sm"
        >
        <button
            type="button"
            onclick={() => void on_fetch_url()}
            disabled={busy || !url_text.trim()}
            class="btn btn-secondary btn-sm shrink-0"
        >
            {busy ? "Loading…" : "Fetch"}
        </button>
    </div>
    <p
        id="compose-font-status"
        aria-live="polite"
        class={error ? "text-sm text-red-700" : "text-sm text-gray-500"}
    >
        {#if error}
            {error}
        {:else if font_registry.entries.length > 0}
            {font_registry.entries.length}
            custom font{font_registry.entries.length === 1 ? "" : "s"}
            loaded
        {:else}
            No custom fonts — pick a file or fetch a URL
        {/if}
    </p>
    {#if font_registry.entries.length > 0}
        <ul class="flex flex-col gap-1">
            {#each font_registry.entries as entry (entry.family)}
                <li class="flex items-center justify-between gap-2 rounded border border-gray-200 bg-white px-2 py-1">
                    <span
                        class="min-w-0 flex-1 truncate text-sm"
                        title={entry.family}
                        style="font-family: '{entry.family}', sans-serif"
                    >
                        {entry.family}
                    </span>
                    <button
                        type="button"
                        onclick={() => on_remove(entry.family)}
                        aria-label={`Remove font ${entry.family}`}
                        class="shrink-0 text-sm text-red-700 underline"
                    >
                        Remove
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>
