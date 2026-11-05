import { format_srt_timestamp, type SubtitleCue } from "./compose-subtitles"
import { split_times } from "./split-timing"

/** Proposed split point for one overlong cue. */
export interface SplitSuggestion {
    cue_index: number
    split_word: number
    preview_a: string
    preview_b: string
    reason: string
}

/** One renderable split choice for a cue. */
export interface SplitOption {
    kind: "recommended" | "alternative" | "custom"
    parts: string[]
    note: string
}

export type TabKind = "recommended" | "alternative" | "custom"

export const NO_SPACE_LOCALES = new Set(["ja", "zh", "ko", "th"])

export const CUE_LOCALES: Record<number, string> = { 1: "en", 2: "ar", 3: "ja", 4: "th" }

const CONJUNCTIONS = ["and", "but", "or", "that", "because"]

/** Fixture covering split cases: EN long, AR, JA (no spaces), TH (no spaces). */
export const SAMPLE_SRT =
    "1\n00:00:01,000 --> 00:00:04,000\nWhen the storm passed over the mountains, the village began to rebuild\n\n" +
    "2\n00:00:05,500 --> 00:00:07,000\nعندما توقفت الأمطار خرج الناس إلى الشوارع\n\n" +
    "3\n00:00:08,000 --> 00:00:10,000\n長い冬が終わり桜の花が咲き始めた\n\n" +
    "4\n00:00:11,000 --> 00:00:13,500\nเมื่อฤดูฝนสิ้นสุดลงชาวบ้านก็เริ่มเตรียมงาน\n"

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
            if (item.isWordLike) {
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

export function join_words(words: string[], locale: string): string {
    const base = locale.split(/[-_]/)[0]?.toLowerCase() ?? locale
    return NO_SPACE_LOCALES.has(base) ? words.join("") : words.join(" ")
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
    return [join_words(words.slice(0, at), locale), join_words(words.slice(at), locale)]
}

/** Rebuild SRT, expanding split cues into two proportionally timed cues renumbered 1..N. */
export function build_split_srt(
    cues: SubtitleCue[],
    splits: Map<number, number>,
    locales?: Record<number, string> | Map<number, string>,
    gap_ms = 10,
): string {
    const locale_for = (index: number): string => {
        if (locales instanceof Map) {
            return locales.get(index) ?? "en"
        }
        return locales?.[index] ?? "en"
    }
    const stamp = (start: number, end: number) => `${format_srt_timestamp(start)} --> ${format_srt_timestamp(end)}`
    const out: string[] = []
    for (const cue of cues) {
        const at = splits.get(cue.index)
        const locale = locale_for(cue.index)
        if (at === undefined) {
            out.push(`${out.length + 1}\n${stamp(cue.start, cue.end)}\n${cue.text}`)
            continue
        }
        if (at <= 0 || at >= tokenize_for_locale(cue.text, locale).length) {
            out.push(`${out.length + 1}\n${stamp(cue.start, cue.end)}\n${cue.text}`)
            continue
        }
        const parts = apply_split(cue.text, at, locale)
        const chars = parts[0].length + parts[1].length
        if (chars === 0) {
            out.push(`${out.length + 1}\n${stamp(cue.start, cue.end)}\n${cue.text}`)
            continue
        }
        const { end_a, start_b } = split_times(cue.start, cue.end, parts[0].length / chars, gap_ms)
        if (end_a === start_b) {
            out.push(`${out.length + 1}\n${stamp(cue.start, cue.end)}\n${cue.text}`)
            continue
        }
        out.push(`${out.length + 1}\n${stamp(cue.start, end_a)}\n${parts[0]}`)
        out.push(`${out.length + 1}\n${stamp(start_b, cue.end)}\n${parts[1]}`)
    }
    return out.length === 0 ? "" : `${out.join("\n\n")}\n`
}
