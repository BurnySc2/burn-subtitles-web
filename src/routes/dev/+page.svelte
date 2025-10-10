<script lang="ts">
import { FFmpeg } from "@ffmpeg/ffmpeg"
// @ts-expect-error
import type { LogEvent, ProgressEvent } from "@ffmpeg/ffmpeg/dist/esm/types"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

let ffmpeg = $state<FFmpeg | null>(null)
let is_processing = $state(false)
let progress = $state(0)
let output_blob = $state<Blob | null>(null)
let output_url = $state<string | null>(null)
let message = $state("Click Convert Video to start")

const base_url = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm"
const video_url = "https://raw.githubusercontent.com/ffmpegwasm/testdata/master/Big_Buck_Bunny_180_10s.webm"
const font_url = "https://fonts.gstatic.com/s/geostar/v27/sykz-yx4n701VLOftSq9-trEvlQ.ttf"

async function load_ffmpeg() {
	if (ffmpeg) return
	ffmpeg = new FFmpeg()

	ffmpeg.on("log", ({ message: msg }: LogEvent) => {
		message = msg
		console.log(message)
	})

	ffmpeg.on("progress", ({ progress: p }: ProgressEvent) => {
		progress = Math.round(p * 100)
	})

	try {
		message = "Loading ffmpeg-core.js"
		await ffmpeg.load({
			coreURL: await toBlobURL(`${base_url}/ffmpeg-core.js`, "text/javascript"),
			wasmURL: await toBlobURL(`${base_url}/ffmpeg-core.wasm`, "application/wasm"),
		})

		// Load font file to /tmp directory
		message = "Loading font file"
		const font_response = await fetch(font_url)
		const font_buffer = await font_response.arrayBuffer()
		await ffmpeg.writeFile("/tmp/Geostar.ttf", new Uint8Array(font_buffer))
		console.log("Font loaded to /tmp")

		message = "FFmpeg loaded successfully"
	} catch (err) {
		console.error("Failed to load FFmpeg:", err)
		message = "Failed to load FFmpeg"
	}
}

async function convert_video() {
	if (!ffmpeg) {
		await load_ffmpeg()
		if (!ffmpeg) return
	}

	is_processing = true
	progress = 0
	message = "Fetching video file"
	output_blob = null
	if (output_url) {
		URL.revokeObjectURL(output_url)
		output_url = null
	}

	try {
		// Fetch video
		const video_data = await fetchFile(video_url)
		await ffmpeg.writeFile("input.webm", video_data)
		message = "Video loaded"

		// Create SRT content
		const srt_content = `1
00:00:00,000 --> 00:00:10,000
sample text`
		const srt_bytes = new TextEncoder().encode(srt_content)
		await ffmpeg.writeFile("sample.srt", srt_bytes)
		message = "SRT created"

		// Run FFmpeg command
		message = "Processing video with subtitles"
		await ffmpeg.exec([
			"-i",
			"input.webm",
			"-vf",
			"subtitles=sample.srt:fontsdir=/tmp:force_style='Fontname=Geostar,FontSize=24'",
			"-c:v",
			"libx264",
			"-c:a",
			"copy",
			"-y",
			"output.mp4",
		])

		// Read output
		message = "Reading output"
		const output_data = await ffmpeg.readFile("output.mp4")
		// @ts-expect-error
		output_blob = new Blob([(output_data as Uint8Array).buffer], { type: "video/mp4" })
		output_url = URL.createObjectURL(output_blob)

		// Cleanup
		await ffmpeg.deleteFile("input.webm")
		await ffmpeg.deleteFile("sample.srt")
		await ffmpeg.deleteFile("/tmp/Geostar.ttf")
		await ffmpeg.deleteFile("output.mp4")

		message = "Conversion complete!"
	} catch (err) {
		console.error("Conversion failed:", err)
		message = `Conversion failed: ${err}`
	} finally {
		is_processing = false
		progress = 0
	}
}

function download_video() {
	if (output_blob && output_url) {
		const a = document.createElement("a")
		a.href = output_url
		a.download = "subtitled-video.mp4"
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}
}
</script>

<div class="container mx-auto max-w-4xl p-6">
	<h1 class="mb-8 text-center text-3xl font-bold">Dev - Video Subtitle Converter</h1>

	<div class="mb-6 rounded-lg bg-blue-50 p-4">
		<p class="text-blue-800">{message}</p>
	</div>

	{#if is_processing}
		<div class="mb-6">
			<div class="h-2 w-full rounded-full bg-gray-200">
				<div class="h-2 rounded-full bg-blue-600 transition-all duration-300" style="width: {progress}%"></div>
			</div>
			<p class="mt-2 text-sm text-gray-600">Progress: {progress}%</p>
		</div>
	{/if}

	<button
		onclick={convert_video}
		disabled={is_processing}
		class="mb-8 w-full rounded bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
	>
		Convert Video
	</button>

	{#if output_url}
		<div class="space-y-6">
			<h2 class="text-2xl font-bold">Output Video</h2>
			<video src={output_url} controls class="w-full max-w-3xl rounded-lg shadow-lg">
				Your browser does not support the video tag.
			</video>
			<button
				onclick={download_video}
				class="rounded bg-blue-600 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-700"
			>
				Download Video
			</button>
		</div>
	{/if}
</div>

<style>
	.container {
		min-height: 100vh;
	}
</style>
