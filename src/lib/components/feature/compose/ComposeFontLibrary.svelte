<script lang="ts">
import { onMount } from "svelte"
import { browser } from "$app/environment"
import {
    font_registry,
    font_registry_version,
    register_font_entry,
    remove_font_entry,
} from "$lib/media/compose-font-library"
import {
    clear_font_url_index,
    get_font_url_auto_restore,
    load_font_url_index,
    remove_font_url_entry,
    save_font_url_entry,
    set_font_url_auto_restore,
    type FontUrlEntry,
} from "$lib/media/compose-font-url-index"
import { load_custom_font, load_custom_font_from_url, revoke_custom_font } from "$lib/utils/custom-font"
import { restore_saved_url_fonts, restore_single_url_font } from "../../../media/compose-font-restore"

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
let saved_url_entries = $state<FontUrlEntry[]>([])
let url_status = $state<Record<string, { status: "loaded" | "failed" | "retrying"; code: string | null; message: string | null }>>({})

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

onMount(() => {
    if (!browser) {
        return
    }
    auto_restore_enabled = get_font_url_auto_restore()
    const index = load_font_url_index()
    saved_url_entries = index.entries
    saved_url_count = index.entries.length
    if (index.entries.length === 0 || !index.auto_restore_enabled) {
        return
    }
    restoring = true
    void restore_saved_url_fonts(index.entries)
        .then(({ restored, skipped, failed, per_entry }) => {
            for (const item of per_entry) {
                const key = item.family.toLowerCase()
                if (item.status === "failed") {
                    url_status[key] = { status: "failed", code: item.code, message: item.message }
                } else {
                    url_status[key] = { status: "loaded", code: null, message: null }
                }
            }
            if (restored === 0 && failed === 0) {
                return
            }
            const parts = [`Restored ${restored} of ${index.entries.length} saved fonts`]
            if (skipped > 0) {
                parts.push(`already loaded ${skipped}`)
            }
            if (failed > 0) {
                parts.push(`failed ${failed}`)
            }
            restore_summary = parts.join(", ")
        })
        .finally(() => {
            restoring = false
        })
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
        restore_summary = null
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
        saved_url_entries = load_font_url_index().entries
        saved_url_count = saved_url_entries.length
        url_status[loaded.font_family.toLowerCase()] = { status: "loaded", code: null, message: null }
        url_text = ""
        restore_summary = null
    } catch (caught) {
        error = caught instanceof Error ? caught.message : "Failed to fetch font URL."
    } finally {
        busy = false
    }
}

function on_remove(family: string): void {
    remove_font_entry(family)
    remove_font_url_entry(family)
    saved_url_entries = load_font_url_index().entries
    saved_url_count = saved_url_entries.length
    restore_summary = null
}

async function retry_saved_url(entry: FontUrlEntry): Promise<void> {
    const key = entry.family.toLowerCase()
    if (url_status[key]?.status === "retrying") {
        return
    }
    url_status[key] = { status: "retrying", code: null, message: null }
    error = null
    try {
        const result = await restore_single_url_font(entry)
        if (!result) {
            const next = { ...url_status }
            delete next[key]
            url_status = next
            return
        }
        if (result.status === "failed") {
            url_status[key] = { status: "failed", code: result.code, message: result.message }
        } else {
            url_status[key] = { status: "loaded", code: null, message: null }
        }
        restore_summary = null
    } catch (caught) {
        error = caught instanceof Error ? caught.message : "Failed to fetch font URL."
        const next = { ...url_status }
        delete next[key]
        url_status = next
    }
}

async function copy_url_text(url: string): Promise<void> {
    if (!browser) {
        return
    }
    try {
        await navigator.clipboard.writeText(url)
    } catch {
        return
    }
}

function on_toggle_auto_restore(enabled: boolean): void {
    auto_restore_enabled = enabled
    set_font_url_auto_restore(enabled)
}

function on_clear_saved_urls(): void {
    clear_font_url_index()
    saved_url_entries = []
    saved_url_count = 0
    restore_summary = null
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
    {#if saved_url_entries.length > 0}
        <div class="flex flex-col gap-1">
            <h4 class="text-sm font-semibold">Saved font URLs ({saved_url_entries.length})</h4>
            <ul class="flex flex-col gap-1">
                {#each saved_url_entries as saved (saved.family)}
                    {@const key = saved.family.toLowerCase()}
                    {@const current = url_status[key]}
                    {@const is_loaded = registry_entries.some((item) => item.family.toLowerCase() === key)}
                    <li class="flex flex-col gap-1 rounded border border-gray-200 bg-white px-2 py-1">
                        <span
                            class="truncate text-sm"
                            title={saved.family}
                            style="font-family: '{saved.family}', sans-serif"
                        >
                            {saved.family}
                        </span>
                        <code class="block max-w-full overflow-x-auto rounded bg-gray-50 p-1 text-xs select-all"
                            >{saved.origin_url}</code
                        >
                        <p class="text-xs text-gray-500">
                            {#if current?.status === "retrying"}
                                Retrying…
                            {:else if current?.status === "failed"}
                                Failed {current.code ?? "UNKNOWN"} — {current.message ?? "fetch failed"}
                            {:else if current?.status === "loaded" || is_loaded}
                                Loaded
                            {:else}
                                Saved
                            {/if}
                        </p>
                        <div class="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onclick={() => void retry_saved_url(saved)}
                                disabled={current?.status === "retrying"}
                                aria-label={`Retry font ${saved.family}`}
                                class="btn btn-secondary btn-sm shrink-0"
                            >
                                Retry
                            </button>
                            <button
                                type="button"
                                onclick={() => void copy_url_text(saved.origin_url)}
                                aria-label={`Copy URL for ${saved.family}`}
                                class="btn btn-secondary btn-sm shrink-0"
                            >
                                Copy URL
                            </button>
                            <button
                                type="button"
                                onclick={() => on_remove(saved.family)}
                                aria-label={`Remove saved URL ${saved.family}`}
                                class="shrink-0 text-sm text-red-700 underline"
                            >
                                Remove saved URL
                            </button>
                        </div>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
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
