export class SubtitleError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SubtitleError"
    }
}

export interface SubtitleCue {
    index: number
    start: number
    end: number
    text: string
}

export interface SrtValidation {
    valid: boolean
    errors: string[]
}

const SRT_STAMP = /(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/
const SRT_STAMP_STRICT = /^\d{2}:\d{2}:\d{2},\d{3}$/
const VTT_STAMP = /(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/

function millis_to_seconds(frac: string): number {
    return Number.parseInt(frac.padEnd(3, "0"), 10) / 1000
}

function stamp_to_seconds(hours: string, minutes: string, seconds: string, frac: string, raw: string): number {
    const h = Number.parseInt(hours, 10)
    const m = Number.parseInt(minutes, 10)
    const s = Number.parseInt(seconds, 10)
    if (m > 59 || s > 59) {
        throw new SubtitleError(`Invalid timestamp "${raw}": minutes and seconds must be below 60`)
    }
    return h * 3600 + m * 60 + s + millis_to_seconds(frac)
}

export function parse_srt_timestamp(raw: string): number {
    const match = raw.trim().match(SRT_STAMP)
    if (!match || match[0] !== raw.trim()) {
        throw new SubtitleError(`Invalid SRT timestamp "${raw}": expected HH:MM:SS,mmm`)
    }
    return stamp_to_seconds(match[1], match[2], match[3], match[4], raw)
}

export function parse_vtt_timestamp(raw: string): number {
    const match = raw.trim().match(VTT_STAMP)
    if (!match || match[0] !== raw.trim()) {
        throw new SubtitleError(`Invalid WebVTT timestamp "${raw}": expected MM:SS.mmm or HH:MM:SS.mmm`)
    }
    return stamp_to_seconds(match[1] ?? "0", match[2], match[3], match[4], raw)
}

export function format_srt_timestamp(total_seconds: number): string {
    return format_vtt_timestamp(total_seconds).replace(".", ",")
}

export function format_vtt_timestamp(total_seconds: number): string {
    const total_ms = Math.round(Math.max(0, total_seconds) * 1000)
    const ms = total_ms % 1000
    const total_s = Math.floor(total_ms / 1000)
    const pad = (n: number, len: number) => n.toString().padStart(len, "0")
    return `${pad(Math.floor(total_s / 3600), 2)}:${pad(Math.floor(total_s / 60) % 60, 2)}:${pad(total_s % 60, 2)}.${pad(ms, 3)}`
}

function escape_vtt_text(text: string): string[] {
    const lines = text.split("\n")
    return lines.map((line) => {
        return line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll(/\s+/g, " ")
    })
}

function unescape_vtt_text(text: string): string {
    return text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&")
}

function split_blocks(content: string): string[] {
    const normalized = content
        .replace(/^\uFEFF/, "")
        .replaceAll("\r\n", "\n")
        .replaceAll("\r", "\n")
    if (normalized.trim() === "") {
        return []
    }
    return normalized.trim().split(/\n\s*\n/)
}

function parse_srt_block(block: string, position: number): SubtitleCue {
    const lines = block.trim().split("\n")
    if (lines.length < 2) {
        throw new SubtitleError(`Invalid SRT block ${position}: expected index, timestamp line, and text`)
    }
    const index = Number.parseInt(lines[0].trim(), 10)
    const stamp_index = Number.isNaN(index) ? 0 : 1
    const stamp_line = lines[stamp_index].trim()
    const arrow = stamp_line.split("-->")
    if (arrow.length !== 2) {
        throw new SubtitleError(`Invalid SRT block ${position}: expected "HH:MM:SS,mmm --> HH:MM:SS,mmm"`)
    }
    const start = parse_srt_timestamp(arrow[0])
    const end = parse_srt_timestamp(arrow[1])
    if (end <= start) {
        throw new SubtitleError(`Invalid SRT block ${position}: end time must be greater than start time`)
    }
    const text = lines
        .slice(stamp_index + 1)
        .join("\n")
        .trim()
    if (text === "") {
        throw new SubtitleError(`Invalid SRT block ${position}: cue text must not be empty`)
    }
    return { index: Number.isNaN(index) ? position : index, start, end, text }
}

export function parse_srt(content: string): SubtitleCue[] {
    return split_blocks(content).map((block, offset) => parse_srt_block(block, offset + 1))
}

export function validate_srt(content: string): SrtValidation {
    const errors: string[] = []
    const blocks = split_blocks(content)
    if (blocks.length === 0) {
        return { valid: false, errors: ["Subtitle file is empty"] }
    }
    blocks.forEach((block, offset) => {
        const position = offset + 1
        const lines = block.trim().split("\n")
        if (lines.length < 3) {
            errors.push(`Block ${position}: expected index, timestamp line, and text`)
            return
        }
        const index = Number.parseInt(lines[0].trim(), 10)
        if (Number.isNaN(index) || index !== position) {
            errors.push(`Block ${position}: expected cue number ${position}`)
        }
        const arrow = lines[1].trim().split("-->")
        if (arrow.length !== 2) {
            errors.push(`Block ${position}: expected "HH:MM:SS,mmm --> HH:MM:SS,mmm"`)
            return
        }
        const [raw_start, raw_end] = [arrow[0].trim(), arrow[1].trim()]
        if (!SRT_STAMP_STRICT.test(raw_start) || !SRT_STAMP_STRICT.test(raw_end)) {
            errors.push(`Block ${position}: timestamps must use HH:MM:SS,mmm with a comma`)
            return
        }
        try {
            const start = parse_srt_timestamp(raw_start)
            const end = parse_srt_timestamp(raw_end)
            if (end <= start) {
                errors.push(`Block ${position}: end time must be greater than start time`)
            }
        } catch (error) {
            errors.push(`Block ${position}: ${(error as Error).message}`)
        }
        if (lines.slice(2).join("\n").trim() === "") {
            errors.push(`Block ${position}: cue text must not be empty`)
        }
    })
    return { valid: errors.length === 0, errors }
}

export function srt_to_vtt(srt_content: string): string {
    const cues = parse_srt(srt_content)
    const body = cues
        .map((cue) => {
            const lines = escape_vtt_text(cue.text)
            return `${format_vtt_timestamp(cue.start)} --> ${format_vtt_timestamp(cue.end)}\n${lines.join("\n")}`
        })
        .join("\n\n")
    return body ? `WEBVTT\n\n${body}\n` : "WEBVTT\n"
}

export function vtt_to_srt(vtt_content: string): string {
    const normalized = vtt_content
        .replace(/^\uFEFF/, "")
        .replaceAll("\r\n", "\n")
        .replaceAll("\r", "\n")
    const lines = normalized.split("\n")
    const start = lines[0].trim() === "WEBVTT" ? 1 : 0
    const cues: Array<{ start: number; end: number; text: string }> = []
    let cursor = start
    const skip_block = () => {
        while (cursor < lines.length && lines[cursor].trim() !== "") {
            cursor += 1
        }
        cursor += 1
    }
    while (cursor < lines.length) {
        while (cursor < lines.length && lines[cursor].trim() === "") {
            cursor += 1
        }
        if (cursor >= lines.length) {
            break
        }
        const head = lines[cursor].trim()
        if (head.startsWith("NOTE") || head === "STYLE" || head === "REGION") {
            cursor += 1
            skip_block()
            continue
        }
        let stamp_line = head
        if (!stamp_line.includes("-->")) {
            cursor += 1
            if (cursor >= lines.length) {
                break
            }
            stamp_line = lines[cursor].trim()
        }
        if (!stamp_line.includes("-->")) {
            throw new SubtitleError(`Invalid WebVTT cue: expected timestamp line, got "${head}"`)
        }
        const arrow = stamp_line.split("-->")
        if (arrow.length !== 2) {
            throw new SubtitleError(`Invalid WebVTT cue: expected "start --> end", got "${stamp_line}"`)
        }
        const start_stamp = arrow[0].trim()
        const end_stamp = arrow[1].trim().split(/\s+/)[0]
        const cue_start = parse_vtt_timestamp(start_stamp)
        const cue_end = parse_vtt_timestamp(end_stamp)
        if (cue_end <= cue_start) {
            throw new SubtitleError("Invalid WebVTT cue: end time must be greater than start time")
        }
        cursor += 1
        const text_lines: string[] = []
        while (cursor < lines.length && lines[cursor].trim() !== "") {
            text_lines.push(lines[cursor])
            cursor += 1
        }
        const text = text_lines.join("\n").trim()
        if (text === "") {
            throw new SubtitleError("Invalid WebVTT cue: cue text must not be empty")
        }
        cues.push({ start: cue_start, end: cue_end, text: unescape_vtt_text(text) })
        cursor += 1
    }
    if (cues.length === 0) {
        return ""
    }
    const body = cues
        .map(
            (cue, offset) =>
                `${offset + 1}\n${format_srt_timestamp(cue.start)} --> ${format_srt_timestamp(cue.end)}\n${cue.text}`,
        )
        .join("\n\n")
    return `${body}\n`
}
