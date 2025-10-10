<script lang="ts">
import { FFmpeg } from "@ffmpeg/ffmpeg"
// @ts-expect-error
import type { LogEvent, ProgressEvent } from "@ffmpeg/ffmpeg/dist/esm/types"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import FontPreview from "./FontPreview.svelte"

type QualityMode = "high" | "preview"

type FfmpegConfig = {
	preset: string
	crf: string
	audio_bitrate: string
}

type FontOption = {
	name: string
	url: string
	filename: string
}

const high_quality_config: FfmpegConfig = {
	preset: "veryslow",
	crf: "18",
	audio_bitrate: "320k",
}

const preview_config: FfmpegConfig = {
	preset: "ultrafast",
	crf: "28",
	audio_bitrate: "128k",
}

const get_config = (mode: QualityMode = "preview"): FfmpegConfig => {
	return mode === "high" ? high_quality_config : preview_config
}

const available_fonts: FontOption[] = [
	{
		name: "Geostar",
		url: "https://fonts.gstatic.com/s/geostar/v27/sykz-yx4n701VLOftSq9-trEvlQ.ttf",
		filename: "Geostar.ttf",
	},
	{
		name: "Noto Sans",
		url: "https://github.com/google/fonts/raw/main/apache/notosans/NotoSans-Regular.ttf",
		filename: "NotoSans-Regular.ttf",
	},
	{
		name: "Roboto",
		url: "https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Regular.ttf",
		filename: "Roboto-Regular.ttf",
	},
	{
		name: "Open Sans",
		url: "https://github.com/google/fonts/raw/main/apache/opensans/OpenSans-Regular.ttf",
		filename: "OpenSans-Regular.ttf",
	},
]

let ffmpeg = $state<FFmpeg | null>(null)
let is_processing = $state(false)
let is_rendering_preview = $state(false)
let progress = $state(0)
let output_blob = $state<Blob | null>(null)
let output_url = $state<string | null>(null)
let preview_url = $state<string | null>(null)
let message = $state("Ready to process")
let error_message = $state<string | null>(null)

let processing_start_time = $state<number | null>(null)
let estimated_total_duration = $state<number>(0)

let selected_quality_mode = $state<QualityMode>("preview")
let selected_font = $state<FontOption>(available_fonts[0])
let font_size = $state(24)
let is_bold = $state(false)
let position = $state<"top" | "bottom" | "center">("bottom")
let preview_timestamp = $state("00:00:05")

const base_url = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm"

let video_file = $state<File | null>(null)
let srt_file = $state<File | null>(null)

function handle_video_upload(event: Event) {
	const target = event.target as HTMLInputElement
	if (target.files?.[0]) {
		video_file = target.files[0]
		if (preview_url) {
			URL.revokeObjectURL(preview_url)
			preview_url = null
		}
	}
}

function handle_video_drop(event: DragEvent) {
	const files = event.dataTransfer?.files
	if (files && files.length > 0) {
		const video = Array.from(files).find((f) => f.type.startsWith("video/"))
		if (video) {
			video_file = video
			if (preview_url) {
				URL.revokeObjectURL(preview_url)
				preview_url = null
			}
		}
	}
}

function handle_srt_upload(event: Event) {
	const target = event.target as HTMLInputElement
	if (target.files?.[0]) {
		srt_file = target.files[0]
		if (preview_url) {
			URL.revokeObjectURL(preview_url)
			preview_url = null
		}
	}
}

function handle_srt_drop(event: DragEvent) {
	const files = event.dataTransfer?.files
	if (files && files.length > 0) {
		const srt = Array.from(files).find((f) => f.name.toLowerCase().endsWith(".srt"))
		if (srt) {
			srt_file = srt
			if (preview_url) {
				URL.revokeObjectURL(preview_url)
				preview_url = null
			}
		}
	}
}

function handle_font_change(event: Event) {
	const target = event.target as HTMLSelectElement
	const selected_index = parseInt(target.value, 10)
	selected_font = available_fonts[selected_index]
	if (preview_url) {
		URL.revokeObjectURL(preview_url)
		preview_url = null
	}
}

function handle_font_size_change(event: Event) {
	const target = event.target as HTMLInputElement
	font_size = parseInt(target.value, 10) || 24
	if (preview_url) {
		URL.revokeObjectURL(preview_url)
		preview_url = null
	}
}

function handle_bold_change(event: Event) {
	const target = event.target as HTMLInputElement
	is_bold = target.checked
	if (preview_url) {
		URL.revokeObjectURL(preview_url)
		preview_url = null
	}
}

function handle_position_change(event: Event) {
	const target = event.target as HTMLSelectElement
	position = target.value as "top" | "bottom" | "center"
	if (preview_url) {
		URL.revokeObjectURL(preview_url)
		preview_url = null
	}
}

function handle_timestamp_change(event: Event) {
	const target = event.target as HTMLInputElement
	preview_timestamp = target.value
	if (preview_url) {
		URL.revokeObjectURL(preview_url)
		preview_url = null
	}
}

function parse_timestamp(timestamp: string): number {
	const parts = timestamp.split(":").map(Number)
	if (parts.length !== 3) {
		throw new Error("Invalid timestamp format. Use hh:mm:ss")
	}
	const [hours, minutes, seconds] = parts
	return hours * 3600 + minutes * 60 + seconds
}

function format_time_remaining(): string {
	if (!processing_start_time || !estimated_total_duration || progress >= 100) {
		return ""
	}

	const elapsed = (Date.now() - processing_start_time) / 1000
	const remaining = estimated_total_duration - elapsed

	if (remaining < 0) return "Finishing up..."

	const minutes = Math.floor(remaining / 60)
	const seconds = Math.floor(remaining % 60)
	return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`
}

$effect(() => {
	const start = processing_start_time
	if (!start) return

	const interval = setInterval(() => {
		const elapsed = (Date.now() - start) / 1000 // seconds
		if (progress > 0 && progress < 100) {
			const estimated_total = elapsed / (progress / 100)
			estimated_total_duration = estimated_total
		}
	}, 1000)

	return () => clearInterval(interval)
})

async function load_ffmpeg() {
	if (ffmpeg) return

	ffmpeg = new FFmpeg()

	ffmpeg.on("log", ({ message: msg }: LogEvent) => {
		console.log("FFmpeg log:", msg)
		// Don't update UI message with technical logs
	})

	ffmpeg.on("progress", ({ progress: p }: ProgressEvent) => {
		progress = Math.round(p * 100)
	})

	try {
		message = "Loading FFmpeg core"
		await ffmpeg.load({
			coreURL: await toBlobURL(`${base_url}/ffmpeg-core.js`, "text/javascript"),
			wasmURL: await toBlobURL(`${base_url}/ffmpeg-core.wasm`, "application/wasm"),
		})

		message = "FFmpeg loaded successfully"
	} catch (err) {
		console.error("Failed to load FFmpeg:", err)
		error_message = "Failed to initialize FFmpeg"
		message = "FFmpeg load failed"
	}
}

async function load_selected_font() {
	if (!ffmpeg) {
		await load_ffmpeg()
		if (!ffmpeg) return false
	}

	try {
		message = `Loading font: ${selected_font.name}`
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
		error_message = `Failed to load font ${selected_font.name}: ${err}`
		message = "Font load failed"
		return false
	}
}

async function render_frame_preview() {
	if (!video_file || !srt_file) {
		error_message = "Please upload both video and SRT files"
		return
	}

	if (!ffmpeg) {
		await load_ffmpeg()
		if (!ffmpeg) return
	}

	const font_loaded = await load_selected_font()
	if (!font_loaded) return

	is_rendering_preview = true
	progress = 0
	error_message = null
	message = "Rendering frame preview..."

	if (preview_url) {
		URL.revokeObjectURL(preview_url)
		preview_url = null
	}

	const timestamp_seconds = parse_timestamp(preview_timestamp)
	if (timestamp_seconds < 0) {
		error_message = "Timestamp must be positive"
		is_rendering_preview = false
		return
	}

	const video_ext = video_file.name.split(".").pop() || "mp4"
	const video_name = `input.${video_ext}`
	const srt_name = "subtitles.srt"
	const output_name = "preview.png"

	try {
		// Write input files
		await ffmpeg.writeFile(video_name, await fetchFile(video_file))
		const srt_bytes = new TextEncoder().encode(await srt_file.text())
		await ffmpeg.writeFile(srt_name, srt_bytes)

		// Build force_style for preview
		const bold_style = is_bold ? ",Bold=-1" : ""
		const alignment_map = {
			top: "8",
			bottom: "2",
			center: "5",
		}
		const alignment = alignment_map[position as keyof typeof alignment_map]
		const force_style = `Fontname=${selected_font.name},FontSize=${font_size}${bold_style},Alignment=${alignment}`

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
		preview_url = URL.createObjectURL(frame_blob)

		// Cleanup
		await ffmpeg.deleteFile(video_name).catch(() => {})
		await ffmpeg.deleteFile(srt_name).catch(() => {})
		await ffmpeg.deleteFile(`/tmp/${selected_font.filename}`).catch(() => {})
		await ffmpeg.deleteFile(output_name).catch(() => {})

		message = `Frame preview rendered at ${preview_timestamp}`
		is_rendering_preview = false
		progress = 100
	} catch (err) {
		console.error("Frame preview failed:", err)
		error_message = `Frame preview failed: ${err}`
		message = "Frame preview failed"

		// Cleanup on error
		await ffmpeg.deleteFile(video_name).catch(() => {})
		await ffmpeg.deleteFile(srt_name).catch(() => {})
		await ffmpeg.deleteFile(`/tmp/${selected_font.filename}`).catch(() => {})
		await ffmpeg.deleteFile(output_name).catch(() => {})

		is_rendering_preview = false
		progress = 0
	}
}

async function process_subtitles() {
	if (!video_file || !srt_file) {
		error_message = "Please upload both video and SRT files"
		return
	}

	if (!ffmpeg) {
		await load_ffmpeg()
		if (!ffmpeg) return
	}

	const font_loaded = await load_selected_font()
	if (!font_loaded) return

	is_processing = true
	processing_start_time = Date.now()
	progress = 0
	error_message = null
	message = "Processing video..."
	output_blob = null
	if (output_url) {
		URL.revokeObjectURL(output_url)
		output_url = null
	}

	const video_ext = video_file.name.split(".").pop() || "mp4"
	const video_name = `input.${video_ext}`
	const srt_name = "subtitles.srt"
	const output_name = "output.mp4"

	try {
		// Write input files
		message = "Loading video file"
		await ffmpeg.writeFile(video_name, await fetchFile(video_file))
		console.log(`Wrote video file: ${video_name}`)

		message = "Loading subtitle file"
		const srt_bytes = new TextEncoder().encode(await srt_file.text())
		await ffmpeg.writeFile(srt_name, srt_bytes)
		console.log("Wrote SRT subtitles file")

		// Build force_style
		const bold_style = is_bold ? ",Bold=-1" : ""
		const alignment_map = {
			top: "8",
			bottom: "2",
			center: "5",
		}
		const alignment = alignment_map[position as keyof typeof alignment_map]
		const force_style = `Fontname=${selected_font.name},FontSize=${font_size}${bold_style},Alignment=${alignment}`

		// Execute FFmpeg command
		message = "Burning subtitles to video"
		const config = get_config(selected_quality_mode)
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
		message = "Generating output"
		const output_data = await ffmpeg.readFile(output_name)
		// @ts-expect-error
		output_blob = new Blob([(output_data as Uint8Array).buffer], {
			type: "video/mp4",
		})
		output_url = URL.createObjectURL(output_blob)

		// Cleanup
		await ffmpeg.deleteFile(video_name).catch(() => {})
		await ffmpeg.deleteFile(srt_name).catch(() => {})
		await ffmpeg.deleteFile(`/tmp/${selected_font.filename}`).catch(() => {})
		await ffmpeg.deleteFile(output_name).catch(() => {})

		message = "Processing complete!"
		is_processing = false
		progress = 100
	} catch (err) {
		console.error("Processing failed:", err)
		error_message = `Processing failed: ${err}`
		message = "Processing failed"

		// Cleanup on error
		await ffmpeg.deleteFile(video_name).catch(() => {})
		await ffmpeg.deleteFile(srt_name).catch(() => {})
		await ffmpeg.deleteFile(`/tmp/${selected_font.filename}`).catch(() => {})
		await ffmpeg.deleteFile(output_name).catch(() => {})

		is_processing = false
		processing_start_time = null
		estimated_total_duration = 0
		progress = 0
	}
}

function download_video() {
	if (output_blob && output_url) {
		const a = document.createElement("a")
		a.href = output_url
		a.download = `subtitled-${video_file?.name.replace(/\.[^/.]+$/, "") || "video"}.mp4`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}
}

function reset_output() {
	if (output_url) {
		URL.revokeObjectURL(output_url)
		output_url = null
	}
	if (preview_url) {
		URL.revokeObjectURL(preview_url)
		preview_url = null
	}
	output_blob = null
	error_message = null
	progress = 0
	message = "Ready to process"
	video_file = null
	srt_file = null
}
</script>

<div
	class="processor-container mx-auto max-w-4xl min-w-0 space-y-6 rounded-xl bg-white p-4 shadow-lg"
>
	<!-- Upload Section -->
	<div
		class="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4"
	>
		<h2 class="mb-4 text-lg font-bold text-gray-800">Upload Files</h2>

		<!-- Video Upload -->
		<div class="mb-4">
			<label
				for="video-upload"
				class="mb-2 block text-sm font-semibold text-gray-700"
				>Video</label
			>
			<div class="relative">
				<input
					id="video-upload"
					type="file"
					accept="video/*"
					onchange={handle_video_upload}
					class="w-full rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 transition-all duration-200 file:mr-2 file:rounded file:border-0 file:bg-green-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-green-700 hover:border-green-400 focus:ring-2 focus:ring-green-500 focus:outline-none"
					disabled={is_processing}
				/>
			</div>
			{#if video_file}
				<p
					class="mt-1 inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
				>
					{video_file.name}
				</p>
			{/if}
		</div>

		<!-- SRT Upload -->
		<div class="mb-4">
			<label
				for="srt-upload"
				class="mb-2 block text-sm font-semibold text-gray-700"
				>SRT</label
			>
			<div class="relative">
				<input
					id="srt-upload"
					type="file"
					accept=".srt"
					onchange={handle_srt_upload}
					class="w-full rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 transition-all duration-200 file:mr-2 file:rounded file:border-0 file:bg-green-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-green-700 hover:border-green-400 focus:ring-2 focus:ring-green-500 focus:outline-none"
					disabled={is_processing}
				/>
			</div>
			{#if srt_file}
				<p
					class="mt-1 inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
				>
					{srt_file.name}
				</p>
			{/if}
		</div>
	</div>

	<!-- Settings Section -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<div
			class="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6"
		>
			<h2 class="mb-4 text-xl font-bold text-gray-800">
				Subtitle Styling
			</h2>

			<!-- Font Selection -->
			<div class="mb-4">
				<label
					for="font-select"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Font Family</label
				>
				<select
					id="font-select"
					value={available_fonts.findIndex(
						(f) => f === selected_font,
					)}
					onchange={handle_font_change}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					disabled={is_processing}
				>
					{#each available_fonts as font, index}
						<option value={index}>{font.name}</option>
					{/each}
				</select>
			</div>

			<!-- Font Size -->
			<div class="mb-4">
				<label
					for="font-size"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Font Size</label
				>
				<input
					id="font-size"
					type="number"
					min="12"
					max="72"
					step="1"
					bind:value={font_size}
					oninput={handle_font_size_change}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					disabled={is_processing}
				/>
			</div>
		</div>

		<div
			class="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6"
		>
			<h2 class="mb-4 text-xl font-bold text-gray-800">
				Position & Timing
			</h2>

			<!-- Position -->
			<div class="mb-6">
				<label
					for="position"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Subtitle Position</label
				>
				<select
					id="position"
					value={position}
					onchange={handle_position_change}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
					disabled={is_processing}
				>
					<option value="bottom">Bottom</option>
					<option value="center">Center</option>
					<option value="top">Top</option>
				</select>
			</div>

			<!-- Preview Timestamp (moved here for better grouping) -->
			{#if video_file && srt_file}
				<div>
					<label
						for="timestamp"
						class="mb-2 block text-sm font-semibold text-gray-700"
						>Preview Timestamp</label
					>
					<input
						type="text"
						id="timestamp"
						value={preview_timestamp}
						oninput={handle_timestamp_change}
						placeholder="00:00:05"
						class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
						disabled={is_processing}
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- Font Preview -->
	<div
		class="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-6"
	>
		<h3 class="mb-4 text-lg font-bold text-gray-800">Font Preview</h3>
		<div class="overflow-hidden rounded-lg bg-white p-4 shadow-inner">
			<div
				class="mx-auto flex h-24 w-full max-w-md items-center justify-center"
			>
				<FontPreview
					font_name={selected_font.name}
					{font_size}
					sample_text="The quick brown fox jumps over the lazy dog"
				/>
			</div>
		</div>
	</div>

	<!-- Frame Preview Section -->
	{#if video_file && srt_file}
		<div
			class="rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-6"
		>
			<h2 class="mb-4 text-xl font-bold text-gray-800">Frame Preview</h2>
			<div class="mb-6 flex flex-col items-center gap-4 sm:flex-row">
				<button
					onclick={render_frame_preview}
					disabled={is_processing || is_rendering_preview}
					class="max-w-xs flex-1 transform rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
				>
					{#if is_rendering_preview}
						<span class="flex items-center justify-center">
							Rendering...
							<div
								class="ml-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
							></div>
						</span>
					{:else}
						Render Frame Preview
					{/if}
				</button>
			</div>
			{#if preview_url}
				<div class="text-center">
					<div class="mx-auto max-w-4xl rounded-lg bg-black p-1">
						<img
							src={preview_url}
							alt="Frame preview with subtitles"
							class="w-full rounded-lg"
							style="max-height: 500px;"
						/>
					</div>
					<p
						class="mt-3 inline-block rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
					>
						Preview at {preview_timestamp}
					</p>
				</div>
			{:else}
				<div class="rounded-lg bg-gray-50 py-8 text-center">
					<p class="mb-2 text-lg text-gray-500">No preview yet</p>
					<p class="text-sm text-gray-400">
						Click "Render Frame Preview" to see how your subtitles
						will look on the video frame.
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Processing Section -->
	<div
		class="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6"
	>
		<h2 class="mb-6 text-xl font-bold text-gray-800">Processing</h2>

		<!-- Quality Mode -->
		<div class="mb-6">
			<label
				for="quality-mode"
				class="mb-3 block text-sm font-semibold text-gray-700"
				>Quality Mode</label
			>
			<select
				id="quality-mode"
				value={selected_quality_mode}
				onchange={(e) =>
					(selected_quality_mode = e.currentTarget
						.value as QualityMode)}
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-green-500 focus:outline-none"
				disabled={is_processing}
			>
				<option value="preview">Preview</option>
				<option value="high">High Quality</option>
			</select>
		</div>

		<!-- Status Messages -->
		{#if error_message}
			<div
				class="mb-6 rounded-lg border-2 border-red-300 bg-red-50 px-5 py-4 text-red-800"
			>
				<div class="flex items-center">
					<span class="mr-3">!</span>
					<span>{error_message}</span>
				</div>
			</div>
		{/if}

		<!-- Message -->
		<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
			<p class="font-medium text-blue-800">{message}</p>
		</div>

		<!-- Progress Bar -->
		{#if is_processing || is_rendering_preview}
			<div class="mb-6">
				<div class="relative pt-1">
					<div class="mb-2 flex items-center justify-between">
						<div>
							<span
								class="inline-block rounded-full bg-teal-200 px-2 py-1 text-xs font-semibold text-teal-600 uppercase"
							>
								Progress
							</span>
						</div>
						<div class="text-right">
							<span
								class="inline-block text-xs font-semibold text-teal-600"
								>{progress}%</span
							>
						</div>
					</div>
					<div
						class="mb-4 flex h-2 overflow-hidden rounded-full bg-gray-200 text-xs"
					>
						<div
							style="width: {progress}%"
							class="flex flex-col justify-center bg-green-500 text-center whitespace-nowrap text-white shadow-none"
						></div>
					</div>
					{#if is_processing && processing_start_time}
						<div class="mt-2 text-center">
							<p class="text-xs text-gray-600">
								{format_time_remaining()}
							</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Process Button -->
		<button
			onclick={process_subtitles}
			disabled={is_processing || !video_file || !srt_file}
			class="flex w-full transform items-center justify-center rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-8 py-4 text-xl font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-green-700 hover:to-green-800 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
		>
			{#if is_processing}
				<span class="flex items-center">
					<div
						class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
					></div>
					Processing Video...
				</span>
			{:else}
				Burn Subtitles to Video
			{/if}
		</button>
	</div>

	<!-- Output Section -->
	{#if output_url}
		<div
			class="space-y-6 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6"
		>
			<h2 class="text-2xl font-bold text-gray-800">Output Ready!</h2>
			<div class="overflow-hidden rounded-xl bg-black shadow-2xl">
				<video
					src={output_url}
					controls
					class="mx-auto w-full max-w-4xl"
				>
					Your browser does not support the video tag.
				</video>
			</div>
			<div
				class="flex flex-col gap-4 border-t border-emerald-200 pt-4 sm:flex-row"
			>
				<button
					onclick={download_video}
					class="flex flex-1 transform items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl"
				>
					Download Video
				</button>
				<button
					onclick={reset_output}
					class="flex flex-1 transform items-center justify-center rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-gray-600 hover:to-gray-700 hover:shadow-xl"
				>
					Start Over
				</button>
			</div>
		</div>
	{:else if video_file && srt_file && !is_processing}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center"
		>
			<h3 class="mb-2 text-lg font-semibold text-gray-700">
				Ready to Process!
			</h3>
			<p class="text-gray-500">
				Select your subtitle settings above and click "Burn Subtitles to
				Video" to create your subtitled video.
			</p>
		</div>
	{:else}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center"
		>
			<h3 class="mb-2 text-lg font-semibold text-gray-700">
				Get Started
			</h3>
			<p class="mb-4 text-gray-500">
				Upload your video file and SRT subtitle file to begin creating
				subtitled videos.
			</p>
			<div class="flex justify-center space-x-4 text-sm text-gray-400">
				<span>Video</span>
				<span class="text-gray-300">→</span>
				<span>Subtitles</span>
				<span class="text-gray-300">→</span>
				<span>Output</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.processor-container {
		max-width: none;
	}
</style>
