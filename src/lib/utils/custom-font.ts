// @ts-expect-error: opentype.js has no bundled types, fallback to any
import opentype from "opentype.js"
import type { CustomFontState } from "$lib/temporary-storage.svelte"
import { available_fonts } from "./fonts"

export const CUSTOM_FONT_FAMILY = "CustomUploadedFont" as const
export const FALLBACK_FONT_FAMILY = CUSTOM_FONT_FAMILY
export const CUSTOM_TMP_PREFIX = "__custom." as const

export function parse_font_family(array_buffer: ArrayBuffer, fallback: string = CUSTOM_FONT_FAMILY): string {
    try {
        const font = opentype.parse(array_buffer)
        // biome-ignore lint/suspicious/noExplicitAny: opentype names are untyped
        const names = (font as any).names
        if (names?.fontFamily?.en) {
            return names.fontFamily.en
        }
        if (names?.fullName?.en) {
            return names.fullName.en
        }
        const fam = names?.fontFamily ? (Object.values(names.fontFamily)[0] as string) : null
        if (fam) {
            return fam
        }
        const full = names?.fullName ? (Object.values(names.fullName)[0] as string) : null
        if (full) {
            return full
        }
        return fallback
    } catch {
        return fallback
    }
}

export function get_ext(filename: string): string {
    const parts = filename.split(".")
    return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? "") : ""
}

export function get_tmp_filename(file: File | { name: string }): `__custom.${string}` {
    const ext = get_ext(file.name) || "ttf"
    return `${CUSTOM_TMP_PREFIX}${ext}` as `__custom.${string}`
}

export function get_effective_font_family(index: number, custom_font: CustomFontState | null): string {
    if (custom_font) {
        return custom_font.font_family
    }
    const clamped = Math.max(0, Math.min(index, available_fonts.length - 1))
    return available_fonts[clamped].font_family
}

export function get_effective_font_weight(index: number, custom_font: CustomFontState | null): "normal" | "bold" {
    if (custom_font) {
        return "normal"
    }
    const clamped = Math.max(0, Math.min(index, available_fonts.length - 1))
    return (available_fonts[clamped].font_weight as "normal" | "bold" | undefined) ?? "normal"
}

export async function load_custom_font(file: File): Promise<CustomFontState> {
    let real_family: string = CUSTOM_FONT_FAMILY
    try {
        const buf = await file.arrayBuffer()
        real_family = parse_font_family(buf, CUSTOM_FONT_FAMILY)
    } catch {}

    const ext = get_ext(file.name)
    if (ext === "woff" || ext === "woff2") {
        console.warn(
            `Custom font is "${ext}" which may not be supported by FFmpeg/libass. Consider converting to TTF/OTF for reliable burning.`,
        )
    }

    const object_url = URL.createObjectURL(file)
    const tmp_filename = get_tmp_filename(file)
    let font_face: FontFace | undefined
    try {
        font_face = new FontFace(real_family, `url(${object_url})`)
        await font_face.load()
        document.fonts.add(font_face)
    } catch (err) {
        console.warn("Custom font preview load failed", err)
    }
    return {
        file,
        object_url,
        font_family: real_family,
        tmp_filename,
        font_face,
    }
}

export function revoke_custom_font(state: CustomFontState | null): void {
    if (!state) {
        return
    }
    try {
        if (state.font_face) {
            document.fonts.delete(state.font_face)
        }
    } catch {}
    try {
        URL.revokeObjectURL(state.object_url)
    } catch {}
}
