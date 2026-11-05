import type { SubtitleCue } from "./compose-subtitles"

/**
 * Characters-per-second for a cue, ignoring line breaks.
 * @param cue Cue to measure.
 * @returns Text length divided by clamped duration.
 */
export function cps(cue: SubtitleCue): number {
    const length = cue.text.replaceAll("\n", "").length
    return length / Math.max(0.1, cue.end - cue.start)
}

/**
 * Whether a cue text exceeds a character budget.
 * @param cue Cue to check.
 * @param max_chars Maximum characters before considered long.
 * @returns True when text is longer than the budget.
 */
export function is_long(cue: SubtitleCue, max_chars = 80): boolean {
    return Array.from(cue.text).length > max_chars
}

/**
 * Filter cues by index marker, text, or time range.
 * @param cues Cues to search.
 * @param query Raw user query; empty returns all cues.
 * @returns Matching cues in original order.
 */
export function filter_cues(cues: SubtitleCue[], query: string): SubtitleCue[] {
    const normalized = query.trim().toLowerCase()
    if (normalized === "") {
        return cues
    }
    return cues.filter((cue) => {
        if (`#${cue.index}`.includes(normalized)) {
            return true
        }
        if (cue.text.toLowerCase().includes(normalized)) {
            return true
        }
        return `${cue.start} --> ${cue.end}`.toLowerCase().includes(normalized)
    })
}

/**
 * Shorten text without splitting surrogate pairs.
 * @param text Text to shorten.
 * @param max Maximum characters to keep.
 * @returns Original text or truncated text with ellipsis.
 */
export function truncate(text: string, max = 80): string {
    const chars = Array.from(text)
    if (chars.length <= max) {
        return text
    }
    return `${chars.slice(0, max).join("")}…`
}
