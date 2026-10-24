export function first_dropped_file(event: DragEvent): File | null {
    return event.dataTransfer?.files?.[0] ?? null
}

export function is_accepted(file: File, kind: "source" | "overlay"): boolean {
    if (kind === "source") {
        return file.type === "" || file.type.startsWith("video/") || file.type.startsWith("audio/")
    }
    return file.type.startsWith("image/")
}
