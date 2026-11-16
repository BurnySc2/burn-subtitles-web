import { sanitize_filename } from "./clip-filename"

export function compose_filename(stem: string, extension: string): string {
    const ext = extension.replace(/^\./, "") || "mp4"
    return `${sanitize_filename(stem) || "composition"}.${ext}`
}
