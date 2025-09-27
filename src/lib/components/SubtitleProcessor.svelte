<script lang="ts">
	import { app_state, update_state } from '../stores/subtitle-store.svelte'
	import FontPreview from './FontPreview.svelte'

	import { FFmpeg } from '@ffmpeg/ffmpeg'
	// @ts-ignore
	import type { LogEvent, ProgressEvent } from '@ffmpeg/ffmpeg/dist/esm/types'
	import { fetchFile, toBlobURL } from '@ffmpeg/util'

	type QualityMode = 'high' | 'preview'

	type FfmpegConfig = {
		preset: string
		crf: string
		audio_bitrate: string
	}

	const high_quality_config: FfmpegConfig = {
		preset: 'veryslow',
		crf: '18',
		audio_bitrate: '320k'
	}

	const preview_config: FfmpegConfig = {
		preset: 'ultrafast',
		crf: '28',
		audio_bitrate: '128k'
	}

	const get_config = (mode: QualityMode = 'preview'): FfmpegConfig => {
		return mode === 'high' ? high_quality_config : preview_config
	}

	let output_url = $derived(app_state.output_blob ? URL.createObjectURL(app_state.output_blob) : null)

	let ffmpeg = $state<FFmpeg | null>(null)
	let local_quality_mode = $state<QualityMode>('preview')
	const base_url = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'

	let start_time = $state<number | null>(null)
	let estimated_remaining = $derived.by(() => {
		if (!app_state.is_processing || !start_time || app_state.progress === 0) {
			return null
		}
		const elapsed = (Date.now() - start_time) / 1000
		const estimated_total = elapsed / (app_state.progress / 100)
		const remaining = Math.max(0, estimated_total - elapsed)
		const minutes = Math.floor(remaining / 60)
		const seconds = Math.floor(remaining % 60)
		return `${minutes}:${seconds.toString().padStart(2, '0')}`
	})

	$effect(() => {
		async function load_ffmpeg() {
			if (ffmpeg) return // Already loaded

			ffmpeg = new FFmpeg()

			ffmpeg.on('log', ({ message: msg }: LogEvent) => {
				console.log('FFmpeg log:', msg)
			})

			ffmpeg.on('progress', ({ progress: p }: ProgressEvent) => {
				if (app_state.is_processing) {
					update_state({ progress: Math.round(p * 100) })
				}
			})

			try {
				await ffmpeg.load({
					coreURL: await toBlobURL(`${base_url}/ffmpeg-core.js`, 'text/javascript'),
					wasmURL: await toBlobURL(`${base_url}/ffmpeg-core.wasm`, 'application/wasm')
				})

				// Load a default font for subtitles to ensure visibility in WASM environment
				try {
					const fontResponse = await fetch('https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNr5TRG.woff2')
					const fontArrayBuffer = await fontResponse.arrayBuffer()
					await ffmpeg.writeFile('noto.ttf', new Uint8Array(fontArrayBuffer))
					console.log('Font file loaded successfully')
				} catch (fontErr) {
					console.warn('Failed to load font file:', fontErr)
				}
				console.log('FFmpeg loaded successfully')
			} catch (err) {
				console.error('Failed to load FFmpeg:', err)
				update_state({ error: 'Failed to initialize FFmpeg' })
			}
		}

		load_ffmpeg()

		return () => {
			if (ffmpeg) {
				ffmpeg.terminate()
			}
		}
	})

	// Real SRT to ASS conversion
	async function srt_to_ass(srt_file: File, settings: typeof app_state.subtitle_settings): Promise<string> {
		const srt_text = await srt_file.text()
		const lines = srt_text.trim().split('\n')

		// Parse SRT blocks: index, start-end, text (empty line separated)
		const subtitle_blocks = []
		let current_block = []

		for (const line of lines) {
			if (line.trim() === '') {
				if (current_block.length > 0) {
					subtitle_blocks.push(current_block)
					current_block = []
				}
			} else {
				current_block.push(line.trim())
			}
		}
		if (current_block.length > 0) {
			subtitle_blocks.push(current_block)
		}

		// Generate ASS header with settings first
		const bold_flag = settings.bold ? '-1' : '0'
		const font_name = settings.font_family // Use selected font
		const outline_width = Math.max(1, Math.floor(settings.font_size / 4))
		const shadow_depth = Math.max(1, Math.floor(settings.font_size / 8))
		const margin_v = settings.position === 'top' ? 50 : settings.position === 'bottom' ? 50 : 20
		const alignment = settings.position === 'top' ? 8 : settings.position === 'center' ? 5 : 2

		// Convert each block to ASS Dialogue
		const dialogues = []
		let layer = 0

		for (const block of subtitle_blocks) {
			if (block.length < 2) continue

			// Parse timings: 00:00:01,000 --> 00:00:05,000
			const timing_line = block[1]
			const time_match = timing_line.match(/(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/)
			if (!time_match) continue

			const start_h = time_match[1]
			const start_ms = time_match[2]
			const end_h = time_match[3]
			const end_ms = time_match[4]

			// Convert to ASS format: h:mm:ss.cs (replace comma with dot, pad ms to 2 digits)
			const start_ass = `${start_h.replace(',', '.')}${String(parseInt(start_ms, 10)).padStart(2, '0')}`
			const end_ass = `${end_h.replace(',', '.')}${String(parseInt(end_ms, 10)).padStart(2, '0')}`

			// Get subtitle text (join lines after timing, escape special chars)
			const text_lines = block.slice(2)
			let text = text_lines.join('\\N').replace(/\{[^}]+\}/g, '') // Join with line breaks, remove ASS tags
			text = text.replace(/&/g, '\\&').replace(/</g, '\\<').replace(/>/g, '\\>')

			dialogues.push(`Dialogue: ${layer},${start_ass},${end_ass},Default,,0,0,0,,${text}`)
			layer++
		}

		const ass_header = `[Script Info]
Title: Converted Subtitles
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

Style: Default,${font_name},${settings.font_size},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,${bold_flag},0,0,0,100,100,0,0,1,${outline_width},${shadow_depth},${alignment},10,10,${margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text

${dialogues.join('\n')}`

		return ass_header
	}

	// Real FFmpeg subtitle burning
	async function ffmpeg_burn_subtitles(video_file: File, ass_content: string): Promise<Blob> {
		if (!ffmpeg) {
			throw new Error('FFmpeg not loaded')
		}

		const video_ext = video_file.name.split('.').pop() || 'mp4'
		const video_name = `input.${video_ext}`
		const ass_name = 'subtitles.ass'
		const output_name = 'output.mp4'

		try {
			// Write input video file
			await ffmpeg.writeFile(video_name, await fetchFile(video_file))
			console.log(`Wrote video file: ${video_name}`)

			// Write ASS subtitles as Uint8Array
			const ass_bytes = new TextEncoder().encode(ass_content)
			await ffmpeg.writeFile(ass_name, ass_bytes)
			console.log('Wrote ASS subtitles file')

			// Execute FFmpeg command: burn subtitles into video
			console.log('Starting FFmpeg processing...')
			const config = get_config(local_quality_mode)
			const font_name = app_state.subtitle_settings.font_family // Use selected font
			const vf_filter = `subtitles=${ass_name}:force_style='FontName=${font_name},FontSize=${app_state.subtitle_settings.font_size},PrimaryColour=&H00FFFFFF,Bold=${app_state.subtitle_settings.bold ? -1 : 0},Alignment=${app_state.subtitle_settings.position === 'top' ? 8 : app_state.subtitle_settings.position === 'bottom' ? 2 : 5}'`
			await ffmpeg.exec([
				'-i',
				video_name,
				'-vf',
				vf_filter,
				'-c:v',
				'libx264',
				'-preset',
				config.preset,
				'-crf',
				config.crf,
				'-pix_fmt',
				'yuv420p',
				'-c:a',
				'aac',
				'-b:a',
				config.audio_bitrate,
				'-y', // Overwrite output
				output_name
			])

			console.log('FFmpeg processing completed')

			// Read output file
			const output_data = await ffmpeg.readFile(output_name)
			// @ts-ignore
			const output_blob = new Blob([(output_data as Uint8Array).buffer], { type: 'video/mp4' })

			// Cleanup temporary files
			try {
				await ffmpeg.deleteFile(video_name)
				await ffmpeg.deleteFile(ass_name)
				await ffmpeg.deleteFile(output_name)
			} catch (cleanup_err) {
				console.warn('Cleanup failed:', cleanup_err)
			}

			return output_blob
		} catch (err) {
			console.error('FFmpeg processing error:', err)
			// Cleanup on error
			try {
				await ffmpeg.deleteFile(video_name).catch(() => {})
				await ffmpeg.deleteFile(ass_name).catch(() => {})
				await ffmpeg.deleteFile(output_name).catch(() => {})
			} catch {}
			throw new Error(`FFmpeg processing failed: ${err}`)
		}
	}

	async function process_subtitles() {
		if (!app_state.video_file || !app_state.srt_file) {
			update_state({ error: 'Please upload both video and SRT files' })
			return
		}

		update_state({
			error: null,
			is_processing: true,
			progress: 0,
			output_blob: null
		})
		start_time = Date.now()

		try {
			// Step 1: Convert SRT to ASS
			update_state({ progress: 25 })
			const srt_text = await app_state.srt_file.text()
			const ass_content = await srt_to_ass(app_state.srt_file, app_state.subtitle_settings)

			// Step 2: Burn subtitles with FFmpeg
			update_state({ progress: 50 })
			const processed_blob = await ffmpeg_burn_subtitles(app_state.video_file, ass_content)

			// Step 3: Store output
			update_state({
				progress: 100,
				output_blob: processed_blob,
				is_processing: false
			})
			start_time = null
		} catch (err) {
			console.error('Processing error:', err)
			update_state({
				error: 'Failed to process video: ' + (err as Error).message,
				is_processing: false,
				progress: 0
			})
			start_time = null
		}
	}

	function download_video() {
		if (app_state.output_blob && output_url) {
			const a = document.createElement('a')
			a.href = output_url
			a.download = `subtitled-${app_state.video_file?.name || 'video.mp4'}`
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
		}
	}

	function reset_output() {
		if (output_url) {
			URL.revokeObjectURL(output_url)
		}
		update_state({ output_blob: null, error: null, progress: 0 })
	}
</script>

<div class="processor-container rounded-lg bg-green-50 p-6">
	<FontPreview />
	<h2 class="mb-4 text-xl font-bold">Process Subtitles</h2>

	{#if app_state.error}
		<div class="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
			{app_state.error}
		</div>
	{/if}

	<div class="mb-4">
		<label for="quality-mode" class="mb-2 block text-sm font-medium text-gray-700">Quality Mode</label>
		<select
			id="quality-mode"
			bind:value={local_quality_mode}
			class="rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
			disabled={app_state.is_processing}
		>
			<option value="preview">Preview (Fast)</option>
			<option value="high">High Quality</option>
		</select>
	</div>

	<button
		onclick={process_subtitles}
		disabled={app_state.is_processing || !app_state.video_file || !app_state.srt_file}
		class="mb-4 w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
	>
		{#if app_state.is_processing}
			Processing... {app_state.progress}%
		{:else}
			Burn Subtitles to Video
		{/if}
	</button>

	{#if app_state.is_processing}
		<div class="mb-4 h-2 w-full rounded-full bg-gray-200">
			<div class="h-2 rounded-full bg-green-600 transition-all duration-300" style="width: {app_state.progress}%"></div>
		</div>

		{#if estimated_remaining}
			<p class="mt-2 text-sm text-gray-600">Estimated time remaining: {estimated_remaining}</p>
		{/if}
	{/if}

	{#if app_state.output_blob}
		<div class="space-y-4">
			<h3 class="text-lg font-semibold">Preview</h3>
			<video src={output_url} controls class="w-full max-w-2xl rounded shadow-lg" style="max-height: 400px;">
				Your browser does not support the video tag.
			</video>

			<button onclick={download_video} class="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
				Download Video
			</button>

			<button onclick={reset_output} class="ml-2 rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
				Start Over
			</button>
		</div>
	{:else if !app_state.is_processing && app_state.video_file && app_state.srt_file}
		<p class="text-gray-500">Upload complete. Configure settings and click "Burn Subtitles to Video" to process.</p>
	{/if}
</div>

<style>
	.processor-container {
		max-width: 600px;
	}
</style>
