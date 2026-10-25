import {
    add_canvas_frame,
    create_video_sample_source,
    OUTPUT_COLOR_SPACE,
    quality_to_video_config,
} from "./transition-utils"

export type CalibrationRgb = [number, number, number]

export interface RedPatchCalibrationOptions {
    width?: number
    height?: number
    frames?: number
}

export interface RedPatchCalibrationResult {
    canvas_rgb: CalibrationRgb
    decoded_rgb: CalibrationRgb | null
    vui: { primaries: unknown; transfer: unknown; matrix: unknown; fullRange: unknown }
    output_vui: unknown
}

export type DecodeProbeConversion = "none" | "default"

export interface DecodeProbeResult {
    rgb: CalibrationRgb | null
    frame_color_space: unknown
    probe_vui: string | null
    width: number
    height: number
}

function read_center_pixel(canvas: HTMLCanvasElement): CalibrationRgb {
    const ctx = canvas.getContext("2d", { alpha: false })
    const fallback: CalibrationRgb = [255, 0, 0]
    if (!ctx) {
        return fallback
    }
    const center_x = Math.floor(canvas.width / 2)
    const center_y = Math.floor(canvas.height / 2)
    const pixel = ctx.getImageData(center_x, center_y, 1, 1).data
    return [pixel[0] ?? 255, pixel[1] ?? 0, pixel[2] ?? 0]
}

function read_vui_from_track(track: unknown): unknown {
    try {
        const record = track as Record<string, unknown>
        const decoder_config = record.decoderConfig as Record<string, unknown> | undefined
        const from_decoder = decoder_config?.colorSpace
        if (from_decoder !== undefined && from_decoder !== null) {
            return from_decoder
        }
        const color_space = record.colorSpace ?? record.video_color_space
        if (color_space !== undefined && color_space !== null) {
            return color_space
        }
    } catch {}
    return null
}

function stringify_vui(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null
    }
    try {
        return JSON.stringify(value)
    } catch {}
    try {
        return String(value)
    } catch {}
    return null
}

function read_center_pixel_nullable(canvas: HTMLCanvasElement): CalibrationRgb | null {
    try {
        const ctx = canvas.getContext("2d", { alpha: false })
        if (!ctx) {
            return null
        }
        const center_x = Math.floor(canvas.width / 2)
        const center_y = Math.floor(canvas.height / 2)
        const pixel = ctx.getImageData(center_x, center_y, 1, 1).data
        return [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0]
    } catch {}
    return null
}

function probe_context(canvas: HTMLCanvasElement, conversion?: DecodeProbeConversion): CanvasRenderingContext2D | null {
    if (conversion) {
        try {
            const settings = {
                alpha: false,
                colorSpace: "srgb",
                colorSpaceConversion: conversion,
            } as CanvasRenderingContext2DSettings
            const converted = canvas.getContext("2d", settings)
            if (converted) {
                return converted
            }
        } catch {}
    }
    try {
        return canvas.getContext("2d", { alpha: false, colorSpace: "srgb" })
    } catch {}
    return null
}

export async function run_red_patch_calibration(
    mb: typeof import("mediabunny"),
    opts?: RedPatchCalibrationOptions,
): Promise<RedPatchCalibrationResult> {
    const width = opts?.width ?? 64
    const height = opts?.height ?? 64
    const frame_count = opts?.frames ?? 5
    const fps = 30
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const paint_ctx = canvas.getContext("2d", { colorSpace: "srgb", alpha: false })
    if (!paint_ctx) {
        return {
            canvas_rgb: [255, 0, 0],
            decoded_rgb: null,
            vui: {
                primaries: OUTPUT_COLOR_SPACE.primaries,
                transfer: OUTPUT_COLOR_SPACE.transfer,
                matrix: OUTPUT_COLOR_SPACE.matrix,
                fullRange: OUTPUT_COLOR_SPACE.fullRange,
            },
            output_vui: null,
        }
    }
    paint_ctx.fillStyle = "#FF0000"
    paint_ctx.fillRect(0, 0, width, height)
    const canvas_rgb = read_center_pixel(canvas)
    const vui = {
        primaries: OUTPUT_COLOR_SPACE.primaries,
        transfer: OUTPUT_COLOR_SPACE.transfer,
        matrix: OUTPUT_COLOR_SPACE.matrix,
        fullRange: OUTPUT_COLOR_SPACE.fullRange,
    }
    let output_vui: unknown = null
    try {
        const target = new mb.BufferTarget()
        const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target })
        const video_source = create_video_sample_source(mb, quality_to_video_config("ultra", width, height, fps), {
            color_space: { ...OUTPUT_COLOR_SPACE },
            hardware_acceleration: "no-preference",
            on_encoder_config: (config) => {
                output_vui = config
            },
        })
        output.addVideoTrack(video_source)
        await output.start()
        try {
            for (let index = 0; index < frame_count; index += 1) {
                await add_canvas_frame(mb, video_source, canvas, index / fps, 1 / fps)
            }
            await output.finalize()
        } catch {
            await output.cancel().catch(() => {})
            return { canvas_rgb, decoded_rgb: null, vui, output_vui }
        }
        if (!target.buffer) {
            return { canvas_rgb, decoded_rgb: null, vui, output_vui }
        }
        const blob = new Blob([target.buffer], { type: output.format.mimeType })
        const input = new mb.Input({
            formats: mb.ALL_FORMATS,
            source: new mb.BlobSource(new File([blob], "red-patch.mp4", { type: blob.type })),
        })
        try {
            const tracks = await input.getVideoTracks()
            const track = tracks[0] ?? null
            if (!track) {
                return { canvas_rgb, decoded_rgb: null, vui, output_vui }
            }
            if (output_vui === null) {
                output_vui = read_vui_from_track(track)
            }
            const sink = new mb.CanvasSink(track, { poolSize: 1 })
            const frames = sink.canvasesAtTimestamps([0])[Symbol.asyncIterator]()
            const wrapped = (await frames.next()).value as { canvas?: HTMLCanvasElement | OffscreenCanvas } | undefined
            if (!wrapped?.canvas) {
                return { canvas_rgb, decoded_rgb: null, vui, output_vui }
            }
            const probe = document.createElement("canvas")
            probe.width = width
            probe.height = height
            const probe_ctx = probe.getContext("2d", { alpha: false })
            if (!probe_ctx) {
                return { canvas_rgb, decoded_rgb: null, vui, output_vui }
            }
            probe_ctx.drawImage(wrapped.canvas, 0, 0)
            return { canvas_rgb, decoded_rgb: read_center_pixel(probe), vui, output_vui }
        } finally {
            input.dispose()
        }
    } catch {
        return { canvas_rgb, decoded_rgb: null, vui, output_vui }
    }
}

export async function run_decode_probe(mb: typeof import("mediabunny"), file: File | Blob): Promise<DecodeProbeResult> {
    return run_decode_probe_with_conversion(mb, file)
}

export async function run_decode_probe_with_conversion(
    mb: typeof import("mediabunny"),
    file: File | Blob,
    conversion?: DecodeProbeConversion,
): Promise<DecodeProbeResult> {
    const empty: DecodeProbeResult = { rgb: null, frame_color_space: null, probe_vui: null, width: 0, height: 0 }
    try {
        const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) })
        try {
            const tracks = await input.getVideoTracks()
            const track = tracks[0] ?? null
            if (!track) {
                return empty
            }
            const probe_vui = stringify_vui(read_vui_from_track(track))
            let frame_color_space: unknown = null
            let width = 0
            let height = 0
            try {
                const ctor = (mb as unknown as Record<string, unknown>).VideoSampleSink as
                    | (new (
                          video_track: unknown,
                      ) => {
                          samplesAtTimestamps(timestamps: number[]): AsyncGenerator<
                              {
                                  colorSpace?: { toJSON?: () => unknown }
                                  displayWidth?: number
                                  displayHeight?: number
                                  codedWidth?: number
                                  codedHeight?: number
                                  close?: () => void
                              } | null,
                              void,
                              unknown
                          >
                      })
                    | undefined
                if (typeof ctor === "function") {
                    const sink = new ctor(track)
                    const iterator = sink.samplesAtTimestamps([0.001])[Symbol.asyncIterator]()
                    const sample = (await iterator.next()).value
                    if (sample) {
                        try {
                            frame_color_space = sample.colorSpace?.toJSON?.() ?? null
                            width = sample.displayWidth ?? sample.codedWidth ?? 0
                            height = sample.displayHeight ?? sample.codedHeight ?? 0
                        } catch {}
                        try {
                            sample.close?.()
                        } catch {}
                    }
                }
            } catch {}
            let rgb: CalibrationRgb | null = null
            try {
                const sink = new mb.CanvasSink(track, { poolSize: 1 })
                const frames = sink.canvasesAtTimestamps([0.001])[Symbol.asyncIterator]()
                const wrapped = (await frames.next()).value as
                    | { canvas?: HTMLCanvasElement | OffscreenCanvas }
                    | null
                    | undefined
                const source_canvas = wrapped?.canvas ?? null
                if (source_canvas) {
                    if (width === 0) {
                        width = source_canvas.width ?? 0
                    }
                    if (height === 0) {
                        height = source_canvas.height ?? 0
                    }
                    const probe = document.createElement("canvas")
                    probe.width = 64
                    probe.height = 64
                    const probe_ctx = probe_context(probe, conversion)
                    if (probe_ctx) {
                        if (conversion === "none") {
                            try {
                                const bitmap = await createImageBitmap(source_canvas, {
                                    colorSpaceConversion: "none",
                                } as ImageBitmapOptions)
                                try {
                                    probe_ctx.drawImage(bitmap, 0, 0, 64, 64)
                                } finally {
                                    try {
                                        bitmap.close()
                                    } catch {}
                                }
                            } catch {
                                probe_ctx.drawImage(source_canvas, 0, 0, 64, 64)
                            }
                        } else {
                            probe_ctx.drawImage(source_canvas, 0, 0, 64, 64)
                        }
                        rgb = read_center_pixel_nullable(probe)
                    }
                }
            } catch {}
            if (width === 0 || height === 0) {
                try {
                    width = width === 0 ? await track.getDisplayWidth() : width
                    height = height === 0 ? await track.getDisplayHeight() : height
                } catch {}
            }
            return { rgb, frame_color_space, probe_vui, width, height }
        } finally {
            input.dispose()
        }
    } catch {}
    return empty
}
