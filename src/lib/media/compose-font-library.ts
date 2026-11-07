/*
 * Snapshot rule: font_registry.entries is a mutable plain object. Readers must
 * subscribe to $font_registry_version and snapshot via list_registry_families()
 * or get_font_suggestions() (both return fresh arrays); never hold a live ref
 * to font_registry.entries across derivations, or memoized refs go stale.
 */
import { get, writable } from "svelte/store"
import { available_fonts } from "../utils/fonts"

export type FontLibrarySource = "bundled" | "custom-file" | "custom-url" | "system"

export interface FontLibraryEntry {
    family: string
    source: FontLibrarySource
    object_url: string | null
    font_face: FontFace | null
    loaded_at: number
    origin_url?: string | null
}

export const font_registry: { entries: FontLibraryEntry[] } = { entries: [] }

export const font_registry_version = writable(0)

function dispose_entry_resources(entry: FontLibraryEntry): void {
    if (entry.object_url) {
        try {
            URL.revokeObjectURL(entry.object_url)
        } catch {}
    }
    if (entry.font_face && typeof document !== "undefined") {
        try {
            document.fonts.delete(entry.font_face)
        } catch {}
    }
}

export function register_font_entry(entry: FontLibraryEntry): void {
    const key = entry.family.toLowerCase()
    const index = font_registry.entries.findIndex((candidate) => candidate.family.toLowerCase() === key)
    if (index >= 0) {
        const previous = font_registry.entries[index]
        if (previous !== entry) {
            dispose_entry_resources(previous)
        }
        font_registry.entries[index] = entry
        font_registry_version.update((count) => count + 1)
        return
    }
    font_registry.entries.push(entry)
    font_registry_version.update((count) => count + 1)
}

export function remove_font_entry(family: string): void {
    const key = family.toLowerCase()
    const index = font_registry.entries.findIndex((candidate) => candidate.family.toLowerCase() === key)
    if (index < 0) {
        return
    }
    const [removed] = font_registry.entries.splice(index, 1)
    if (removed) {
        dispose_entry_resources(removed)
    }
    font_registry_version.update((count) => count + 1)
}

export function clear_font_registry(): void {
    if (font_registry.entries.length === 0) {
        return
    }
    for (const entry of font_registry.entries) {
        dispose_entry_resources(entry)
    }
    font_registry.entries = []
    font_registry_version.update((count) => count + 1)
}

export function list_bundled_families(): string[] {
    const seen = new Set<string>()
    const families: string[] = []
    for (const font of available_fonts) {
        const key = font.font_family.toLowerCase()
        if (seen.has(key)) {
            continue
        }
        seen.add(key)
        families.push(font.font_family)
    }
    return families
}

export function list_registry_families(): string[] {
    return [...font_registry.entries.map((entry) => entry.family)]
}

export function list_document_families(): string[] {
    if (typeof document === "undefined") {
        return []
    }
    try {
        const seen = new Set<string>()
        const families: string[] = []
        for (const face of document.fonts.values()) {
            const key = face.family.toLowerCase()
            if (seen.has(key)) {
                continue
            }
            seen.add(key)
            families.push(face.family)
        }
        return families
    } catch {
        return []
    }
}

export function get_font_suggestions(): string[] {
    const bundled = list_bundled_families()
    const registry = list_registry_families()
    const system_names = new Set(
        font_registry.entries.filter((entry) => entry.source === "system").map((entry) => entry.family.toLowerCase()),
    )
    const by_key = new Map<string, string>()
    for (const family of [...bundled, ...registry]) {
        const key = family.toLowerCase()
        if (!by_key.has(key)) {
            by_key.set(key, family)
        }
    }
    const document_only: string[] = []
    for (const family of list_document_families()) {
        const key = family.toLowerCase()
        if (!by_key.has(key)) {
            by_key.set(key, family)
            document_only.push(family)
        }
        system_names.add(key)
    }
    const document_keys = new Set(document_only.map((family) => family.toLowerCase()))
    const known = [...by_key.values()]
    known.sort((a, b) => {
        const a_system = system_names.has(a.toLowerCase()) || document_keys.has(a.toLowerCase())
        const b_system = system_names.has(b.toLowerCase()) || document_keys.has(b.toLowerCase())
        if (a_system !== b_system) {
            return a_system ? 1 : -1
        }
        return a.localeCompare(b)
    })
    return [...known]
}

export function is_font_available(family: string): boolean {
    const key = family.toLowerCase()
    for (const bundled of list_bundled_families()) {
        if (bundled.toLowerCase() === key) {
            return true
        }
    }
    for (const entry of font_registry.entries) {
        if (entry.family.toLowerCase() === key) {
            return true
        }
    }
    for (const loaded of list_document_families()) {
        if (loaded.toLowerCase() === key) {
            return true
        }
    }
    return false
}

export function build_datalist_id(node_id: string, index: number): string {
    return `font-list-${node_id}-${index}`
}

/**
 * Pure prerender-safe snapshot key for font-dependent caches: combines the
 * current registry version with sorted normalized referenced families.
 * Reads the version via `get()` without subscribing, so module import and
 * SSR/prerender evaluation stay side-effect free.
 */
export function font_cache_key(referenced: string[] = []): string {
    const version = get(font_registry_version)
    const normalized = [...new Set(referenced.map((family) => family.trim().toLowerCase()).filter(Boolean))].sort()
    return `${version}:${normalized.join(",")}`
}
