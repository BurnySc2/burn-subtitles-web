export function sanitize_filename(value: string): string {
    const printable = [...value].filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127).join("")
    return printable
        .replaceAll(":", "-")
        .replace(/[/\\?%*|"<>+]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60)
        .trim()
}

export function clip_basename(source_name: string): string {
    const dot = source_name.lastIndexOf(".")
    const stem = dot > 0 ? source_name.slice(0, dot) : source_name
    return sanitize_filename(stem) || "clip"
}

export function clip_filename(source_name: string, start_str: string, end_str: string, extension: string): string {
    const ext = extension.replace(/^\./, "")
    return `${clip_basename(source_name)}_${sanitize_filename(start_str)}-${sanitize_filename(end_str)}.${ext}`
}
