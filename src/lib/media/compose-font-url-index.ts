import * as z from "zod"
import { browser } from "$app/environment"

const STORAGE_KEY = "font_url_index"
const MAX_ENTRIES = 20

function is_http_url(value: string): boolean {
    try {
        const parsed = new URL(value)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
        return false
    }
}

export const FontUrlEntry = z.object({
    family: z.string().min(1).max(200),
    origin_url: z.string().min(1).refine(is_http_url),
    saved_at: z.number(),
})

export const FontUrlIndex = z.object({
    entries: z.array(FontUrlEntry).max(MAX_ENTRIES).catch([]),
    auto_restore_enabled: z.boolean().catch(true),
})

export type FontUrlEntry = z.infer<typeof FontUrlEntry>
export type FontUrlIndex = z.infer<typeof FontUrlIndex>

function default_font_url_index(): FontUrlIndex {
    return { entries: [], auto_restore_enabled: true }
}

function persist_font_url_index(index: FontUrlIndex): void {
    if (!browser) {
        return
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(index))
    } catch {
        return
    }
}

export function load_font_url_index(): FontUrlIndex {
    if (!browser) {
        return default_font_url_index()
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) {
            return default_font_url_index()
        }
        return FontUrlIndex.parse(JSON.parse(raw))
    } catch {
        return default_font_url_index()
    }
}

export function save_font_url_entry(input: { family: string; origin_url: string }): void {
    if (!browser) {
        return
    }
    const family = input.family.trim()
    const parsed = FontUrlEntry.safeParse({ family, origin_url: input.origin_url, saved_at: Date.now() })
    if (!parsed.success) {
        return
    }
    const index = load_font_url_index()
    const rest = index.entries.filter((entry) => entry.family.toLowerCase() !== family.toLowerCase())
    rest.push(parsed.data)
    while (rest.length > MAX_ENTRIES) {
        rest.shift()
    }
    persist_font_url_index({ entries: rest, auto_restore_enabled: index.auto_restore_enabled })
}

export function remove_font_url_entry(family: string): void {
    if (!browser) {
        return
    }
    const index = load_font_url_index()
    const rest = index.entries.filter((entry) => entry.family.toLowerCase() !== family.trim().toLowerCase())
    if (rest.length === index.entries.length) {
        return
    }
    persist_font_url_index({ entries: rest, auto_restore_enabled: index.auto_restore_enabled })
}

export function clear_font_url_index(): void {
    if (!browser) {
        return
    }
    const index = load_font_url_index()
    persist_font_url_index({ entries: [], auto_restore_enabled: index.auto_restore_enabled })
}

export function set_font_url_auto_restore(enabled: boolean): void {
    if (!browser) {
        return
    }
    const index = load_font_url_index()
    persist_font_url_index({ entries: index.entries, auto_restore_enabled: enabled })
}

export function get_font_url_auto_restore(): boolean {
    return load_font_url_index().auto_restore_enabled
}
