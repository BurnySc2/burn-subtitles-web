// @ts-expect-error: opentype.js has no bundled types, fallback to any
import opentype from "opentype.js"
import type { CustomFontState } from "$lib/temporary-storage.svelte"
import { available_fonts } from "./fonts"

export const CUSTOM_FONT_FAMILY = "CustomUploadedFont" as const
export const FALLBACK_FONT_FAMILY = CUSTOM_FONT_FAMILY
export const CUSTOM_TMP_PREFIX = "__custom." as const

export type FontLoadErrorCode = "TIMEOUT" | "CORS_OR_NETWORK" | "INVALID_FONT" | "ABORTED"

export interface FontLoadError extends Error {
    code: FontLoadErrorCode
}

function create_font_load_error(code: FontLoadErrorCode, message: string, cause?: unknown): FontLoadError {
    const err = new Error(message, cause === undefined ? undefined : { cause }) as FontLoadError
    err.name = "FontLoadError"
    err.code = code
    return err
}

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

function filename_from_url(url: string): string {
    try {
        const pathname = new URL(url, "http://localhost").pathname
        const segment = decodeURIComponent(pathname.split("/").pop() ?? "")
        if (segment) {
            return segment
        }
    } catch {}
    return "custom-font.ttf"
}

async function ingest_font_buffer(array_buffer: ArrayBuffer, filename: string): Promise<CustomFontState> {
    const real_family = parse_font_family(array_buffer, CUSTOM_FONT_FAMILY)
    const ext = get_ext(filename)
    if (ext === "woff" || ext === "woff2") {
        console.warn(
            `Custom font is "${ext}" which may not be supported by FFmpeg/libass. Consider converting to TTF/OTF for reliable burning.`,
        )
    }
    const file = new File([array_buffer], filename)
    const object_url = URL.createObjectURL(file)
    const tmp_filename = get_tmp_filename({ name: filename })
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

export async function load_custom_font(file: File): Promise<CustomFontState> {
    const buf = await file.arrayBuffer()
    return ingest_font_buffer(buf, file.name)
}

export async function load_custom_font_from_url(
    url: string,
    options: { timeout_ms?: number; signal?: AbortSignal } = {},
): Promise<CustomFontState> {
    const { timeout_ms = 15000, signal } = options
    if (signal?.aborted) {
        throw create_font_load_error("ABORTED", `Font load aborted: ${url}`)
    }
    const controller = new AbortController()
    const on_abort = () => controller.abort()
    signal?.addEventListener("abort", on_abort, { once: true })
    let timed_out = false
    const timer = setTimeout(() => {
        timed_out = true
        controller.abort()
    }, timeout_ms)
    try {
        let response: Response
        try {
            response = await fetch(url, { signal: controller.signal })
        } catch (err) {
            if (controller.signal.aborted || (err as DOMException)?.name === "AbortError") {
                if (timed_out) {
                    throw create_font_load_error("TIMEOUT", `Font load timed out after ${timeout_ms}ms: ${url}`, err)
                }
                throw create_font_load_error("ABORTED", `Font load aborted: ${url}`, err)
            }
            throw create_font_load_error("CORS_OR_NETWORK", `Font fetch failed (network or CORS): ${url}`, err)
        }
        if (!response.ok) {
            throw create_font_load_error("CORS_OR_NETWORK", `Font fetch failed with status ${response.status}: ${url}`)
        }
        let buf: ArrayBuffer
        try {
            buf = await response.arrayBuffer()
        } catch (err) {
            throw create_font_load_error("INVALID_FONT", `Font body unreadable: ${url}`, err)
        }
        if (buf.byteLength === 0) {
            throw create_font_load_error("INVALID_FONT", `Font file is empty: ${url}`)
        }
        try {
            opentype.parse(buf)
        } catch (err) {
            throw create_font_load_error("INVALID_FONT", `Font file is not a valid font: ${url}`, err)
        }
        const state = await ingest_font_buffer(buf, filename_from_url(url))
        if (!state.font_face) {
            revoke_custom_font(state)
            throw create_font_load_error("INVALID_FONT", `Font could not be loaded for preview: ${url}`)
        }
        return state
    } finally {
        clearTimeout(timer)
        signal?.removeEventListener("abort", on_abort)
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
