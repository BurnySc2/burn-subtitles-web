export function first_dropped_file(event: DragEvent): File | null {
    return event.dataTransfer?.files?.[0] ?? null
}

export type ComposeDropKind = "source" | "overlay" | "subtitles"

export function is_accepted(file: File, kind: ComposeDropKind): boolean {
    if (kind === "source") {
        return file.type === "" || file.type.startsWith("video/") || file.type.startsWith("audio/")
    }
    if (kind === "subtitles") {
        return /\.srt$/i.test(file.name)
    }
    return file.type.startsWith("image/")
}
