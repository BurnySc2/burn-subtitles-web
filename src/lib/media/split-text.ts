import type { SubtitleCue } from "./compose-subtitles"

export type TabKind = "recommended" | "alternative" | "custom"

const CONJUNCTIONS = ["and", "but", "or", "that", "because"]

/** Locales exercised by the split prototype UI. */
export const SAMPLE_LOCALES = ["en", "ar", "ja", "zh", "ko", "th"]

/** Split text on runs of whitespace, dropping empties. */
export function tokenize_whitespace(text: string): string[] {
    return text.split(/\s+/).filter((part) => part.length > 0)
}

/** Split text into words via Intl.Segmenter when available, else whitespace. */
export function tokenize_segmenter(text: string, locale: string): string[] {
    try {
        const holder = Intl as unknown as {
            Segmenter?: new (
                locale: string,
                opts: { granularity: string },
            ) => {
                segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }>
            }
        }
        if (typeof holder.Segmenter !== "function") {
            return tokenize_whitespace(text)
        }
        const segmenter = new holder.Segmenter(locale, { granularity: "word" })
        const parts: string[] = []
        for (const item of segmenter.segment(text)) {
            if (item.segment.trim() !== "") {
                parts.push(item.segment)
            }
        }
        return parts.length > 0 ? parts : tokenize_whitespace(text)
    } catch {
        return tokenize_whitespace(text)
    }
}

function split_scores(words: string[], max_chars: number): number[] {
    const mid = Math.max(1, words.join(" ").length) / 2
    const scores: number[] = []
    let left = 0
    for (let i = 1; i < words.length; i++) {
        left += words[i - 1].length + 1
        const balance = 1 - Math.min(1, Math.abs(left - mid) / mid)
        const bonus = boundary_bonus(words[i - 1], words[i].toLowerCase())
        scores.push(bonus + balance * 0.6 + (left <= max_chars ? 0.1 : 0))
    }
    return scores
}
function boundary_bonus(prev: string, next: string): number {
    if (/[.?!]$/.test(prev)) {
        return 1
    }
    if (/[;:]$/.test(prev)) {
        return 0.7
    }
    if (/,$/.test(prev)) {
        return 0.5
    }
    return CONJUNCTIONS.includes(next) ? 0.4 : 0
}

/** Recommend the word index to split before, balancing length and punctuation. */
export function recommend_split(words: string[], max_chars = 42): number {
    if (words.length < 2) {
        return 0
    }
    const scores = split_scores(words, max_chars)
    return scores.indexOf(Math.max(...scores)) + 1
}

/** Return a runner-up split index distinct from the recommended one. */
export function alternative_split(words: string[], recommended: number, max_chars = 42): number {
    if (words.length < 2) {
        return 0
    }
    const scores = split_scores(words, max_chars)
    const floor = Math.max(...scores) * 0.85
    for (let i = 0; i < scores.length; i++) {
        if (i + 1 !== recommended && scores[i] >= floor) {
            return i + 1
        }
    }
    const offset = Math.max(1, Math.floor(words.length / 4)) * (recommended * 2 > words.length ? -1 : 1)
    const shifted = Math.min(words.length - 1, Math.max(1, recommended + offset))
    return shifted === recommended ? Math.max(1, Math.min(words.length - 1, recommended + 1)) : shifted
}

export function tokenize_for_locale(text: string, locale: string): string[] {
    return tokenize_segmenter(text, locale)
}

export function split_at_for(text: string, kind: TabKind, locale: string): number {
    const words = tokenize_for_locale(text, locale)
    if (words.length < 2) {
        return 0
    }
    if (kind === "alternative") {
        return alternative_split(words, recommend_split(words))
    }
    if (kind === "custom") {
        return 0
    }
    return recommend_split(words)
}

export function preview_parts(cue: SubtitleCue, tab: TabKind, custom: string[] | undefined, locale: string): string[] {
    if (custom !== undefined) {
        return custom
    }
    const at = split_at_for(cue.text, tab, locale)
    if (at <= 0) {
        return [cue.text]
    }
    return apply_split(cue.text, at, locale)
}

/** Split text into two parts at the given word index. */
export function apply_split(text: string, split_word: number, locale = "en"): string[] {
    const words = tokenize_for_locale(text, locale)
    if (words.length < 2) {
        return [text]
    }
    const at = Math.min(words.length - 1, Math.max(1, Math.round(split_word)))
    let cursor = 0
    for (let i = 0; i < at; i++) {
        const found = text.indexOf(words[i], cursor)
        if (found === -1) {
            return [text]
        }
        cursor = found + words[i].length
    }
    const head = text.slice(0, cursor).trim()
    const tail = text.slice(cursor).trim()
    if (head.length === 0 || tail.length === 0) {
        return [text]
    }
    return [head, tail]
}
