import { load_custom_font_from_url } from "../utils/custom-font"
import { is_font_available, register_font_entry } from "./compose-font-library"
import type { FontUrlEntry } from "./compose-font-url-index"

export interface RestoreSavedFontsResult {
    restored: number
    skipped: number
    failed: number
}

let restoring = false

export async function restore_saved_url_fonts(entries: FontUrlEntry[]): Promise<RestoreSavedFontsResult> {
    if (restoring) {
        return { restored: 0, skipped: 0, failed: 0 }
    }
    restoring = true
    let restored = 0
    let skipped = 0
    let failed = 0
    try {
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
    } finally {
        restoring = false
    }
    return { restored, skipped, failed }
}
