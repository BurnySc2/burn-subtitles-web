import type { FontLoadErrorCode } from "../utils/custom-font"
import { load_custom_font_from_url } from "../utils/custom-font"
import { is_font_available, register_font_entry } from "./compose-font-library"
import type { FontUrlEntry } from "./compose-font-url-index"

export type FontRestoreStatus = "restored" | "skipped" | "failed"

export interface FontRestoreEntryResult {
    family: string
    origin_url: string
    status: FontRestoreStatus
    code: FontLoadErrorCode | null
    message: string | null
}

export interface RestoreSavedFontsResult {
    restored: number
    skipped: number
    failed: number
    per_entry: FontRestoreEntryResult[]
}

let restoring = false

export async function restore_saved_url_fonts(entries: FontUrlEntry[]): Promise<RestoreSavedFontsResult> {
    if (restoring) {
        return { restored: 0, skipped: 0, failed: 0, per_entry: [] }
    }
    restoring = true
    let restored = 0
    let skipped = 0
    let failed = 0
    const per_entry: FontRestoreEntryResult[] = []
    try {
        for (const entry of entries) {
            if (is_font_available(entry.family)) {
                skipped += 1
                per_entry.push({
                    family: entry.family,
                    origin_url: entry.origin_url,
                    status: "skipped",
                    code: null,
                    message: null,
                })
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
                per_entry.push({
                    family: entry.family,
                    origin_url: entry.origin_url,
                    status: "restored",
                    code: null,
                    message: null,
                })
            } catch (err) {
                failed += 1
                const candidate = err as { name?: unknown; code?: unknown; message?: unknown }
                const code =
                    candidate?.name === "FontLoadError" && typeof candidate.code === "string"
                        ? (candidate.code as FontLoadErrorCode)
                        : null
                const message = err instanceof Error ? err.message : String(err)
                per_entry.push({ family: entry.family, origin_url: entry.origin_url, status: "failed", code, message })
            }
        }
    } finally {
        restoring = false
    }
    return { restored, skipped, failed, per_entry }
}

export async function restore_single_url_font(entry: FontUrlEntry): Promise<FontRestoreEntryResult | undefined> {
    const result = await restore_saved_url_fonts([entry])
    return result.per_entry[0]
}
