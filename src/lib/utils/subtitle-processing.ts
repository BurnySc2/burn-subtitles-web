import { FFmpeg } from "@ffmpeg/ffmpeg"
// @ts-expect-error
import type { LogEvent, ProgressEvent } from "@ffmpeg/ffmpeg/dist/esm/types"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

export type QualityMode = "high" | "preview"

export type FfmpegConfig = {
	preset: string
	crf: string
	audio_bitrate: string
}

export type FontOption = {
	name: string
	url: string
	filename: string
}

export type ProcessingState = {
	ffmpeg: FFmpeg | null
	is_processing: boolean
	is_rendering_preview: boolean
	progress: number
	output_blob: Blob | null
	output_url: string | null
	preview_url: string | null
	message: string
	error_message: string | null
	processing_start_time: number | null
	estimated_total_duration: number
	selected_quality_mode: QualityMode
	selected_font_index: number
	font_size: number
	is_bold: boolean
	position: "top" | "bottom" | "center"
	preview_timestamp: string
	video_file: File | null
	srt_file: File | null
}

export type ASSProcessingState = ProcessingState & {
	text_color: string // #ffff7f
	font_size: number // 70
	stroke_size: number // 2 (fixed)
	stroke_color: string // #000000
	shadow_blur: number // 0-20
	shadow_opacity: number // 0-100
	subtitle_position_y: number // 140
	subtitle_center_x: number // 960
}

export const high_quality_config: FfmpegConfig = {
	preset: "veryslow",
	crf: "18",
	audio_bitrate: "320k",
}

export const preview_config: FfmpegConfig = {
	preset: "ultrafast",
	crf: "28",
	audio_bitrate: "128k",
}

export const get_config = (mode: QualityMode = "preview"): FfmpegConfig => {
	return mode === "high" ? high_quality_config : preview_config
}

export const available_fonts: FontOption[] = [
	// Needs to be in sync with +layout.svelte font-face
	// Always download the Font-Regular version
	// https://fonts.google.com
	{
		name: "Roboto",
		url: "/fonts/Roboto.ttf",
		filename: "Roboto.ttf",
	},
	{
		name: "OpenSans",
		url: "/fonts/OpenSans.ttf",
		filename: "OpenSans.ttf",
	},
	{
		name: "Tajawal",
		url: "/fonts/Tajawal.ttf",
		filename: "Tajawal.ttf",
	},
	{
		name: "Cairo",
		url: "/fonts/Cairo.ttf",
		filename: "Cairo.ttf",
	},
	{
		name: "Rubik",
		url: "/fonts/Rubik.ttf",
		filename: "Rubik.ttf",
	},
	{
		name: "Noto Kufi Arabic",
		url: "/fonts/NotoKufiArabic.ttf",
		filename: "NotoKufiArabic.ttf",
	},
	{
		name: "Noto Sans",
		url: "/fonts/NotoSans.ttf",
		filename: "NotoSans.ttf",
	},
	{
		name: "Noto Sans Arabic",
		url: "/fonts/NotoSansArabic.ttf",
		filename: "NotoSansArabic.ttf",
	},
	{
		name: "Noto Sans Japanese",
		url: "/fonts/NotoSansJP.ttf",
		filename: "NotoSansJP.ttf",
	},
	{
		name: "Noto Sans Korean",
		url: "/fonts/NotoSansKR.ttf",
		filename: "NotoSansKR.ttf",
	},
	{
		name: "Noto Sans Thai",
		url: "/fonts/NotoSansThai.ttf",
		filename: "NotoSansThai.ttf",
	},
	{
		name: "Noto Sans Traditional Chinese",
		url: "/fonts/NotoSansTC.ttf",
		filename: "NotoSansTC.ttf",
	},
]

const base_url = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm"

export function create_initial_state(): ProcessingState {
	return {
		ffmpeg: null,
		is_processing: false,
		is_rendering_preview: false,
		progress: 0,
		output_blob: null,
		output_url: null,
		preview_url: null,
		message: "Ready to process",
		error_message: null,
		processing_start_time: null,
		estimated_total_duration: 0,
		selected_quality_mode: "preview",
		selected_font_index: 0,
		font_size: 24,
		is_bold: false,
		position: "bottom",
		preview_timestamp: "00:00:05",
		video_file: null,
		srt_file: null,
	}
}

export function parse_timestamp(timestamp: string): number {
	const parts = timestamp.split(":").map(Number)
	if (parts.length !== 3) {
		throw new Error("Invalid timestamp format. Use hh:mm:ss")
	}
	const [hours, minutes, seconds] = parts
	return hours * 3600 + minutes * 60 + seconds
}

export function format_time_remaining(processing_start_time: number | null, progress: number): string {
	if (!processing_start_time || progress <= 0 || progress >= 100) {
		return ""
	}

	const estimated_total_duration_ms = (100 * (Date.now() - processing_start_time)) / progress
	const elapsed_ms = Date.now() - processing_start_time
	const remaining_s = (estimated_total_duration_ms - elapsed_ms) / 1000

	// console.log([estimated_total_duration_ms, elapsed_ms, remaining_s])

	if (remaining_s < 0) return "Finishing up..."

	const minutes = Math.floor(remaining_s / 60)
	const seconds = Math.floor(remaining_s % 60)
	return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`
}

export async function load_ffmpeg(
	ffmpeg: FFmpeg | null,
	set_message: (message: string) => void,
	set_error_message: (error: string) => void,
	set_progress: (progress: number) => void,
): Promise<FFmpeg | null> {
	if (ffmpeg) return ffmpeg

	const new_ffmpeg = new FFmpeg()

	new_ffmpeg.on("log", ({ message: msg }: LogEvent) => {
		console.log("FFmpeg log:", msg)
		// Don't update UI message with technical logs
	})

	new_ffmpeg.on("progress", ({ progress: p }: ProgressEvent) => {
		set_progress(Math.round(p * 100))
	})

	try {
		set_message("Loading FFmpeg core")
		await new_ffmpeg.load({
			coreURL: await toBlobURL(`${base_url}/ffmpeg-core.js`, "text/javascript"),
			wasmURL: await toBlobURL(`${base_url}/ffmpeg-core.wasm`, "application/wasm"),
		})

		set_message("FFmpeg loaded successfully")
		return new_ffmpeg
	} catch (err) {
		console.error("Failed to load FFmpeg:", err)
		set_error_message("Failed to initialize FFmpeg")
		set_message("FFmpeg load failed")
		return null
	}
}

export async function load_selected_font(
	ffmpeg: FFmpeg | null,
	selected_font_index: number,
	set_message: (message: string) => void,
	set_error_message: (error: string) => void,
): Promise<boolean> {
	if (!ffmpeg) {
		return false
	}

	const selected_font = available_fonts[selected_font_index]
	try {
		set_message(`Loading font: ${selected_font.name}`)

		// For local fonts in /fonts/ folder, we need to fetch them as resources
		const font_response = await fetch(selected_font.url)
		if (!font_response.ok) {
			throw new Error(`Failed to fetch font: ${font_response.statusText}`)
		}
		const font_buffer = await font_response.arrayBuffer()
		await ffmpeg.writeFile(`/tmp/${selected_font.filename}`, new Uint8Array(font_buffer))
		console.log(`Font ${selected_font.name} loaded to /tmp`)
		return true
	} catch (err) {
		console.error("Failed to load font:", err)
		set_error_message(`Failed to load font ${selected_font.name}: ${err}`)
		set_message("Font load failed")
		return false
	}
}

// Helper function to clean up FFmpeg files
async function cleanup_ffmpeg_files(
	ffmpeg: FFmpeg,
	video_name: string,
	srt_name: string,
	font_filename: string,
	output_name: string,
): Promise<void> {
	await ffmpeg.deleteFile(video_name).catch(() => {})
	await ffmpeg.deleteFile(srt_name).catch(() => {})
	await ffmpeg.deleteFile(`/tmp/${font_filename}`).catch(() => {})
	await ffmpeg.deleteFile(output_name).catch(() => {})
}

// Helper function to write video and subtitle files to FFmpeg
async function write_input_files(
	ffmpeg: FFmpeg,
	video_file: File,
	srt_file: File,
	srt_name: string = "subtitles.srt",
): Promise<void> {
	await ffmpeg.writeFile(`input.${video_file.name.split(".").pop() || "mp4"}`, await fetchFile(video_file))
	const srt_bytes = new TextEncoder().encode(await srt_file.text())
	await ffmpeg.writeFile(srt_name, srt_bytes)
}

// Helper function to set up preview state
function setup_preview_state(
	set_state: (new_state: Partial<ProcessingState>) => void,
	message: string = "Rendering frame preview...",
): void {
	set_state({
		is_rendering_preview: true,
		progress: 0,
		error_message: null,
		message,
	})
}

// Helper function to set up processing state
function setup_processing_state(
	set_state: (new_state: Partial<ProcessingState>) => void,
	message: string = "Processing video...",
): void {
	set_state({
		is_processing: true,
		processing_start_time: Date.now(),
		progress: 0,
		error_message: null,
		message,
		output_blob: null,
	})
}

// Helper function to initialize FFmpeg and load font
async function initialize_ffmpeg_and_load_font(
	ffmpeg: FFmpeg | null,
	selected_font_index: number,
	set_message: (message: string) => void,
	set_error_message: (error: string) => void,
	set_progress: (progress: number) => void,
): Promise<FFmpeg | null> {
	const ffmpeg_instance = await load_ffmpeg(ffmpeg, set_message, set_error_message, set_progress)
	if (!ffmpeg_instance) return null

	const font_loaded = await load_selected_font(ffmpeg_instance, selected_font_index, set_message, set_error_message)
	if (!font_loaded) return null

	return ffmpeg_instance
}

export function build_force_style(
	font_index: number,
	font_size: number,
	is_bold: boolean,
	position: "top" | "bottom" | "center",
): string {
	const bold_style = is_bold ? ",Bold=-1" : ""
	const alignment_map = {
		top: "8",
		bottom: "2",
		center: "5",
	}
	const alignment = alignment_map[position]
	const font_name = available_fonts[font_index].name
	return `Fontname=${font_name},FontSize=${font_size}${bold_style},Alignment=${alignment}`
}

export async function render_frame_preview(
	state: ProcessingState,
	set_state: (new_state: Partial<ProcessingState>) => void,
	set_message: (message: string) => void,
	set_error_message: (error: string) => void,
): Promise<void> {
	if (!state.video_file || !state.srt_file) {
		set_error_message("Please upload both video and SRT files")
		return
	}

	const ffmpeg = await initialize_ffmpeg_and_load_font(
		state.ffmpeg,
		state.selected_font_index,
		set_message,
		set_error_message,
		(progress) => set_state({ progress }),
	)
	if (!ffmpeg) return

	setup_preview_state(set_state, "Rendering frame preview...")

	if (state.preview_url) {
		URL.revokeObjectURL(state.preview_url)
	}

	const timestamp_seconds = parse_timestamp(state.preview_timestamp)
	if (timestamp_seconds < 0) {
		set_error_message("Timestamp must be positive")
		set_state({ is_rendering_preview: false })
		return
	}

	const video_ext = state.video_file.name.split(".").pop() || "mp4"
	const video_name = `input.${video_ext}`
	const srt_name = "subtitles.srt"
	const output_name = "preview.png"

	try {
		// Write input files
		await write_input_files(ffmpeg, state.video_file, state.srt_file, srt_name)

		// Build force_style for preview
		const force_style = build_force_style(state.selected_font_index, state.font_size, state.is_bold, state.position)

		// Execute FFmpeg command for frame extraction with subtitles
		const vf_filter = `subtitles=${srt_name}:fontsdir=/tmp:force_style='${force_style}'`
		await ffmpeg.exec([
			"-i",
			video_name,
			"-ss",
			timestamp_seconds.toString(),
			"-avoid_negative_ts",
			"make_zero",
			"-vf",
			vf_filter,
			"-frames:v",
			"1",
			"-update",
			"1",
			"-y",
			output_name,
		])

		// Read output
		const frame_data = await ffmpeg.readFile(output_name)
		// @ts-expect-error
		const frame_blob = new Blob([(frame_data as Uint8Array).buffer], {
			type: "image/png",
		})
		const preview_url = URL.createObjectURL(frame_blob)

		// Cleanup
		await cleanup_ffmpeg_files(
			ffmpeg,
			video_name,
			srt_name,
			available_fonts[state.selected_font_index].filename,
			output_name,
		)

		set_state({
			message: `Frame preview rendered at ${state.preview_timestamp}`,
			is_rendering_preview: false,
			progress: 100,
			preview_url,
			ffmpeg,
		})
	} catch (err) {
		console.error("Frame preview failed:", err)
		set_error_message(`Frame preview failed: ${err}`)
		set_message("Frame preview failed")

		// Cleanup on error
		await cleanup_ffmpeg_files(
			ffmpeg,
			video_name,
			srt_name,
			available_fonts[state.selected_font_index].filename,
			output_name,
		)

		set_state({
			is_rendering_preview: false,
			progress: 0,
			ffmpeg,
		})
	}
}

export async function process_subtitles(
	state: ProcessingState,
	set_state: (new_state: Partial<ProcessingState>) => void,
	set_message: (message: string) => void,
	set_error_message: (error: string) => void,
): Promise<void> {
	if (!state.video_file || !state.srt_file) {
		set_error_message("Please upload both video and SRT files")
		return
	}

	const ffmpeg = await initialize_ffmpeg_and_load_font(
		state.ffmpeg,
		state.selected_font_index,
		set_message,
		set_error_message,
		(progress) => set_state({ progress }),
	)
	if (!ffmpeg) return

	setup_processing_state(set_state, "Processing video...")

	if (state.output_url) {
		URL.revokeObjectURL(state.output_url)
	}

	const video_ext = state.video_file.name.split(".").pop() || "mp4"
	const video_name = `input.${video_ext}`
	const srt_name = "subtitles.srt"
	const output_name = "output.mp4"

	try {
		// Write input files
		set_message("Loading video file")
		await write_input_files(ffmpeg, state.video_file, state.srt_file, srt_name)
		console.log(`Wrote video file: ${video_name}`)
		console.log("Wrote SRT subtitles file")

		// Build force_style
		const force_style = build_force_style(state.selected_font_index, state.font_size, state.is_bold, state.position)

		// Execute FFmpeg command
		set_message("Burning subtitles to video")
		const config = get_config(state.selected_quality_mode)
		const vf_filter = `subtitles=${srt_name}:fontsdir=/tmp:force_style='${force_style}'`
		await ffmpeg.exec([
			"-i",
			video_name,
			"-vf",
			vf_filter,
			"-c:v",
			"libx264",
			"-preset",
			config.preset,
			"-crf",
			config.crf,
			"-pix_fmt",
			"yuv420p",
			"-c:a",
			"aac",
			"-b:a",
			config.audio_bitrate,
			"-y",
			output_name,
		])

		// Read output
		set_message("Generating output")
		const output_data = await ffmpeg.readFile(output_name)
		// @ts-expect-error
		const output_blob = new Blob([(output_data as Uint8Array).buffer], {
			type: "video/mp4",
		})
		const output_url = URL.createObjectURL(output_blob)

		// Cleanup
		await cleanup_ffmpeg_files(
			ffmpeg,
			video_name,
			srt_name,
			available_fonts[state.selected_font_index].filename,
			output_name,
		)

		set_state({
			message: "Processing complete!",
			is_processing: false,
			progress: 100,
			output_blob,
			output_url,
			ffmpeg,
		})
	} catch (err) {
		console.error("Processing failed:", err)
		set_error_message(`Processing failed: ${err}`)
		set_message("Processing failed")

		// Cleanup on error
		await cleanup_ffmpeg_files(
			ffmpeg,
			video_name,
			srt_name,
			available_fonts[state.selected_font_index].filename,
			output_name,
		)

		set_state({
			is_processing: false,
			processing_start_time: null,
			estimated_total_duration: 0,
			progress: 0,
			ffmpeg,
		})
	}
}

// Helper function to convert hex color to ASS format
function hex_to_ass(hex_color: string): string {
	// Remove # if present
	const hex = hex_color.replace(/^#/, "")

	// Validate hex format
	if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
		throw new Error(`Invalid hex color format: ${hex_color}. Expected RRGGBB format.`)
	}

	// Parse RGB components
	const r = parseInt(hex.substring(0, 2), 16)
	const g = parseInt(hex.substring(2, 4), 16)
	const b = parseInt(hex.substring(4, 6), 16)

	// Validate RGB values are within valid range
	if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
		throw new Error(`Invalid RGB values in hex color: ${hex_color}`)
	}

	// Convert to ASS format (BBGGRR)
	return `${b.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${r.toString(16).padStart(2, "0")}`
}

// Helper function to parse SRT file and convert to ASS dialogues
function parse_srt_to_dialogues(srt_content: string): Array<{
	start: string
	end: string
	text: string
}> {
	const dialogues: Array<{ start: string; end: string; text: string }> = []
	const blocks = srt_content.trim().split(/\n\s*\n/)

	for (const block of blocks) {
		const lines = block.trim().split("\n")
		if (lines.length >= 3) {
			const _index = lines[0]
			const time_line = lines[1]
			const text = lines.slice(2).join("\n")

			// Parse time line: 00:00:000 --> 00:00:000
			const time_match = time_line.match(/(\d{2}:\d{2}:\d{2}),\d{3} --> (\d{2}:\d{2}:\d{2}),\d{3}/)
			if (time_match) {
				dialogues.push({
					start: time_match[1],
					end: time_match[2],
					text: text.trim(),
				})
			}
		}
	}

	return dialogues
}

// Helper function to escape special characters in ASS text
function escape_ass_text(text: string): string {
	// Escape ASS special characters: {, }, \\n
	return text.replace(/[{}\\]/g, "\\$&")
}

// Generate ASS file from SRT content and styling parameters
export function generate_ass_file(state: ASSProcessingState, srt_content?: string): string {
	const dialogues = srt_content ? parse_srt_to_dialogues(srt_content) : []

	const ass_header = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

Style: Default,${available_fonts[state.selected_font_index].name},${state.font_size},&H${hex_to_ass(state.text_color)},&H000000,&H${hex_to_ass(state.stroke_color)},&H000000,0,0,0,0,100,100,0,0,1,${state.stroke_size},${state.shadow_blur},2,0,0,${state.subtitle_position_y},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

	const dialogue_lines = dialogues
		.map((d) => {
			// Convert SRT time format (HH:MM:SS) to ASS time format (H:MM:SS.CC)
			const format_time = (time_str: string) => {
				const [hours, minutes, seconds] = time_str.split(":").map(Number)
				// Use format: H:MM:SS.CC (e.g., 0:00:10.00, 1:05:30.00)
				return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.00`
			}

			return `Dialogue: 0,${format_time(d.start)},${format_time(d.end)},Default,,0,0,0,,${escape_ass_text(d.text)}`
		})
		.join("\n")

	return ass_header + (dialogue_lines ? `\n${dialogue_lines}` : "")
}

// Render ASS frame preview
export async function render_ass_frame_preview(
	state: ASSProcessingState,
	set_state: (new_state: Partial<ASSProcessingState>) => void,
	set_message: (message: string) => void,
	set_error_message: (error: string) => void,
): Promise<void> {
	if (!state.video_file || !state.srt_file) {
		set_error_message("Please upload both video and SRT files")
		return
	}

	const ffmpeg = await initialize_ffmpeg_and_load_font(
		state.ffmpeg,
		state.selected_font_index,
		set_message,
		set_error_message,
		(progress) => set_state({ progress }),
	)
	if (!ffmpeg) return

	setup_preview_state(set_state, "Rendering ASS frame preview...")

	if (state.preview_url) {
		URL.revokeObjectURL(state.preview_url)
	}

	const timestamp_seconds = parse_timestamp(state.preview_timestamp)
	if (timestamp_seconds < 0) {
		set_error_message("Timestamp must be positive")
		set_state({ is_rendering_preview: false })
		return
	}

	const video_ext = state.video_file.name.split(".").pop() || "mp4"
	const video_name = `input.${video_ext}`
	const srt_content = await state.srt_file.text()
	const ass_content = generate_ass_file(state, srt_content)
	const _ass_file = new File([ass_content], "subtitles.ass", { type: "text/plain" })
	const output_name = "preview.png"

	try {
		// Write input files
		await ffmpeg.writeFile(video_name, await fetchFile(state.video_file))
		const ass_bytes = new TextEncoder().encode(ass_content)
		await ffmpeg.writeFile("subtitles.ass", ass_bytes)

		// Build ASS filter
		const ass_filter = `ass='subtitles.ass':fontsdir=/tmp`

		// Execute FFmpeg command for frame extraction with ASS subtitles
		await ffmpeg.exec([
			"-i",
			video_name,
			"-ss",
			timestamp_seconds.toString(),
			"-avoid_negative_ts",
			"make_zero",
			"-vf",
			ass_filter,
			"-frames:v",
			"1",
			"-update",
			"1",
			"-y",
			output_name,
		])

		// Read output
		const frame_data = await ffmpeg.readFile(output_name)
		// @ts-expect-error
		const frame_blob = new Blob([(frame_data as Uint8Array).buffer], {
			type: "image/png",
		})
		const preview_url = URL.createObjectURL(frame_blob)

		// Cleanup
		await cleanup_ffmpeg_files(
			ffmpeg,
			video_name,
			"subtitles.ass",
			available_fonts[state.selected_font_index].filename,
			output_name,
		)

		set_state({
			message: `ASS frame preview rendered at ${state.preview_timestamp}`,
			is_rendering_preview: false,
			progress: 100,
			preview_url,
			ffmpeg,
		})
	} catch (err) {
		console.error("ASS frame preview failed:", err)
		set_error_message(`ASS frame preview failed: ${err}`)
		set_message("ASS frame preview failed")

		// Cleanup on error
		await cleanup_ffmpeg_files(
			ffmpeg,
			video_name,
			"subtitles.ass",
			available_fonts[state.selected_font_index].filename,
			output_name,
		)

		set_state({
			is_rendering_preview: false,
			progress: 0,
			ffmpeg,
		})
	}
}

// Process video with ASS subtitles
export async function process_ass_subtitles(
	state: ASSProcessingState,
	set_state: (new_state: Partial<ASSProcessingState>) => void,
	set_message: (message: string) => void,
	set_error_message: (error: string) => void,
): Promise<void> {
	if (!state.video_file || !state.srt_file) {
		set_error_message("Please upload both video and SRT files")
		return
	}

	const ffmpeg = await initialize_ffmpeg_and_load_font(
		state.ffmpeg,
		state.selected_font_index,
		set_message,
		set_error_message,
		(progress) => set_state({ progress }),
	)
	if (!ffmpeg) return

	setup_processing_state(set_state, "Processing video with ASS subtitles...")

	if (state.output_url) {
		URL.revokeObjectURL(state.output_url)
	}

	const video_ext = state.video_file.name.split(".").pop() || "mp4"
	const video_name = `input.${video_ext}`
	const srt_content = await state.srt_file.text()
	const ass_content = generate_ass_file(state, srt_content)
	const _ass_file = new File([ass_content], "subtitles.ass", { type: "text/plain" })
	const output_name = "output.mp4"

	try {
		// Write input files
		set_message("Loading video file")
		await ffmpeg.writeFile(video_name, await fetchFile(state.video_file))
		console.log(`Wrote video file: ${video_name}`)

		set_message("Generating ASS subtitle file")
		const ass_bytes = new TextEncoder().encode(ass_content)
		await ffmpeg.writeFile("subtitles.ass", ass_bytes)
		console.log("Wrote ASS subtitles file")

		// Build ASS filter
		const ass_filter = `ass='subtitles.ass':fontsdir=/tmp`

		// Execute FFmpeg command
		set_message("Burning ASS subtitles to video")
		const config = get_config(state.selected_quality_mode)
		await ffmpeg.exec([
			"-i",
			video_name,
			"-vf",
			ass_filter,
			"-c:v",
			"libx264",
			"-preset",
			config.preset,
			"-crf",
			config.crf,
			"-pix_fmt",
			"yuv420p",
			"-c:a",
			"aac",
			"-b:a",
			config.audio_bitrate,
			"-y",
			output_name,
		])

		// Read output
		set_message("Generating output")
		const output_data = await ffmpeg.readFile(output_name)
		// @ts-expect-error
		const output_blob = new Blob([(output_data as Uint8Array).buffer], {
			type: "video/mp4",
		})
		const output_url = URL.createObjectURL(output_blob)

		// Cleanup
		await cleanup_ffmpeg_files(
			ffmpeg,
			video_name,
			"subtitles.ass",
			available_fonts[state.selected_font_index].filename,
			output_name,
		)

		set_state({
			message: "ASS subtitle processing complete!",
			is_processing: false,
			progress: 100,
			output_blob,
			output_url,
			ffmpeg,
		})
	} catch (err) {
		console.error("ASS processing failed:", err)
		set_error_message(`ASS processing failed: ${err}`)
		set_message("ASS processing failed")

		// Cleanup on error
		await cleanup_ffmpeg_files(
			ffmpeg,
			video_name,
			"subtitles.ass",
			available_fonts[state.selected_font_index].filename,
			output_name,
		)

		set_state({
			is_processing: false,
			processing_start_time: null,
			estimated_total_duration: 0,
			progress: 0,
			ffmpeg,
		})
	}
}

export function download_video(output_blob: Blob | null, output_url: string | null, video_file: File | null): void {
	if (output_blob && output_url) {
		const a = document.createElement("a")
		a.href = output_url
		a.download = `subtitled-${video_file?.name.replace(/\.[^/.]+$/, "") || "video"}.mp4`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}
}

export function reset_output(set_state: (new_state: Partial<ProcessingState>) => void): void {
	set_state({
		output_url: null,
		preview_url: null,
		output_blob: null,
		error_message: null,
		progress: 0,
		message: "Ready to process",
		video_file: null,
		srt_file: null,
	})
}
