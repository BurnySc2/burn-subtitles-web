<script lang="ts">
import { onMount } from "svelte"
import { browser } from "$app/environment"
import {
    font_registry,
    font_registry_version,
    is_font_available,
    register_font_entry,
    remove_font_entry,
} from "$lib/media/compose-font-library"
import {
    clear_font_url_index,
    type FontUrlEntry,
    get_font_url_auto_restore,
    load_font_url_index,
    remove_font_url_entry,
    save_font_url_entry,
    set_font_url_auto_restore,
} from "$lib/media/compose-font-url-index"
import { load_custom_font, load_custom_font_from_url, revoke_custom_font } from "$lib/utils/custom-font"

let registry_entries = $derived.by(() => {
    $font_registry_version
    return [...font_registry.entries]
})

let file_input: HTMLInputElement | null = $state(null)
let url_text = $state("")
let busy = $state(false)
let error = $state<string | null>(null)
let restoring = $state(false)
let restore_summary = $state<string | null>(null)
let auto_restore_enabled = $state(true)
let saved_url_count = $state(0)

let status_text = $derived.by(() => {
    if (restoring && registry_entries.length === 0) {
        return "Restoring saved fonts…"
    }
    const base =
        registry_entries.length > 0
            ? `${registry_entries.length} custom font${registry_entries.length === 1 ? "" : "s"} loaded`
            : "No custom fonts — pick a file or fetch a URL"
    const extras: string[] = []
    if (restore_summary) {
        extras.push(restore_summary)
    }
    if (restoring) {
        extras.push("Restoring saved fonts…")
    }
    if (!auto_restore_enabled) {
        extras.push("Auto-restore off")
    }
    return extras.length > 0 ? `${base}. ${extras.join(". ")}` : base
})

async function restore_saved_fonts(entries: FontUrlEntry[]): Promise<void> {
    restoring = true
    let restored = 0
    let skipped = 0
    let failed = 0
    for (const entry of entries) {
        if (is_font_available(entry.family)) {
            skipped += 1
            continue
        }
        try {
            const loaded = await load_custom_font_from_url(entry.origin_url)
            register_font_entry({
                family: loaded.font_family,
                source: "custom-url",
                object_url: loaded.object_url,
                font_face: loaded.font_face ?? null,
                loaded_at: Date.now(),
                origin_url: entry.origin_url,
            })
            restored += 1
        } catch {
            failed += 1
        }
    }
    restoring = false
    const parts = [`Restored ${restored} of ${entries.length} saved fonts`]
    if (skipped > 0) {
        parts.push(`skipped ${skipped}`)
    }
    if (failed > 0) {
        parts.push(`failed ${failed}`)
    }
    restore_summary = parts.join(", ")
}

onMount(() => {
    if (!browser) {
        return
    }
    auto_restore_enabled = get_font_url_auto_restore()
    const index = load_font_url_index()
    saved_url_count = index.entries.length
    if (index.entries.length === 0 || !index.auto_restore_enabled) {
        return
    }
    void restore_saved_fonts(index.entries)
})

async function on_pick_file(file: File | null): Promise<void> {
    if (!file || busy) {
        return
    }
    busy = true
    error = null
    try {
        const loaded = await load_custom_font(file)
        if (!loaded.font_face) {
            revoke_custom_font(loaded)
            error = `Font could not be loaded for preview: ${file.name}`
            return
        }
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
        save_font_url_entry({ family: loaded.font_family, origin_url: url })
        saved_url_count = load_font_url_index().entries.length
        url_text = ""
    } catch (caught) {
        error = caught instanceof Error ? caught.message : "Failed to fetch font URL."
    } finally {
        busy = false
    }
}

function on_remove(family: string): void {
    remove_font_entry(family)
    remove_font_url_entry(family)
    saved_url_count = load_font_url_index().entries.length
}

function on_toggle_auto_restore(enabled: boolean): void {
    auto_restore_enabled = enabled
    set_font_url_auto_restore(enabled)
}

function on_clear_saved_urls(): void {
    clear_font_url_index()
    saved_url_count = 0
}
</script>

<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-100 p-4">
    <h3 class="text-lg font-semibold">Font library</h3>
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
        {:else}
            {status_text}
        {/if}
    </p>
    <p class="text-sm text-gray-500">Saved URLs refetch on next visit. Files are never stored.</p>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label class="flex items-center gap-2 text-sm text-gray-700">
            <input
                type="checkbox"
                bind:checked={auto_restore_enabled}
                onchange={(e) => on_toggle_auto_restore(e.currentTarget.checked)}
                class="h-4 w-4"
            >
            Auto-restore saved fonts
        </label>
        <button
            type="button"
            onclick={on_clear_saved_urls}
            disabled={saved_url_count === 0}
            class="shrink-0 text-sm text-red-700 underline disabled:text-gray-400 disabled:no-underline"
        >
            Delete saved URLs{saved_url_count > 0 ? ` (${saved_url_count})` : ""}
        </button>
    </div>
    {#if registry_entries.length > 0}
        <ul class="flex flex-col gap-1">
            {#each registry_entries as entry (entry.family)}
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
