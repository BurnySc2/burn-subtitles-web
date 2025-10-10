<script lang="ts">
import {
	type ASSProcessingState,
	available_fonts,
	create_initial_state,
	download_video,
	type FontOption,
	format_time_remaining,
	generate_ass_file,
	process_ass_subtitles,
	type QualityMode,
	render_ass_frame_preview,
	reset_output,
} from "$lib/utils/subtitle-processing"
import FontPreview from "./FontPreview.svelte"

let state = $state<ASSProcessingState>({
	...create_initial_state(),
	text_color: "#ffff7f",
	font_size: 24,
	stroke_size: 2,
	stroke_color: "#000000",
	shadow_blur: 0,
	shadow_opacity: 50,
	subtitle_position_y: 140,
	subtitle_center_x: 960,
})

function handle_video_upload(event: Event) {
	const target = event.target as HTMLInputElement
	if (target.files?.[0]) {
		state = { ...state, video_file: target.files[0] }
		if (state.preview_url) {
			URL.revokeObjectURL(state.preview_url)
			state = { ...state, preview_url: null }
		}
	}
}

function handle_video_drop(event: DragEvent) {
	const files = event.dataTransfer?.files
	if (files && files.length > 0) {
		const video = Array.from(files).find((f) => f.type.startsWith("video/"))
		if (video) {
			state = { ...state, video_file: video }
			if (state.preview_url) {
				URL.revokeObjectURL(state.preview_url)
				state = { ...state, preview_url: null }
			}
		}
	}
}

function handle_srt_upload(event: Event) {
	const target = event.target as HTMLInputElement
	if (target.files?.[0]) {
		state = { ...state, srt_file: target.files[0] }
		if (state.preview_url) {
			URL.revokeObjectURL(state.preview_url)
			state = { ...state, preview_url: null }
		}
	}
}

function handle_srt_drop(event: DragEvent) {
	const files = event.dataTransfer?.files
	if (files && files.length > 0) {
		const srt = Array.from(files).find((f) => f.name.toLowerCase().endsWith(".srt"))
		if (srt) {
			state = { ...state, srt_file: srt }
			if (state.preview_url) {
				URL.revokeObjectURL(state.preview_url)
				state = { ...state, preview_url: null }
			}
		}
	}
}

function handle_quality_change(event: Event) {
	const target = event.target as HTMLSelectElement
	state = { ...state, selected_quality_mode: target.value as QualityMode }
}

function handle_font_change(event: Event) {
	const target = event.target as HTMLSelectElement
	const font_name = target.value
	const selected = available_fonts.find((font) => font.name === font_name)
	if (selected) {
		state = { ...state, selected_font: selected }
	}
}

function handle_font_size_change(event: Event) {
	const target = event.target as HTMLInputElement
	state = { ...state, font_size: parseInt(target.value, 10) }
}

function handle_text_color_change(event: Event) {
	const target = event.target as HTMLInputElement
	state = { ...state, text_color: target.value }
}

function handle_stroke_size_change(event: Event) {
	const target = event.target as HTMLInputElement
	state = { ...state, stroke_size: parseInt(target.value, 10) }
}

function handle_stroke_color_change(event: Event) {
	const target = event.target as HTMLInputElement
	state = { ...state, stroke_color: target.value }
}

function handle_shadow_blur_change(event: Event) {
	const target = event.target as HTMLInputElement
	state = { ...state, shadow_blur: parseInt(target.value, 10) }
}

function handle_shadow_opacity_change(event: Event) {
	const target = event.target as HTMLInputElement
	state = { ...state, shadow_opacity: parseInt(target.value, 10) }
}

function handle_position_y_change(event: Event) {
	const target = event.target as HTMLInputElement
	state = { ...state, subtitle_position_y: parseInt(target.value, 10) }
}

function handle_position_change(event: Event) {
	const target = event.target as HTMLSelectElement
	state = { ...state, position: target.value as "top" | "bottom" | "center" }
}

function handle_timestamp_change(event: Event) {
	const target = event.target as HTMLInputElement
	state = { ...state, preview_timestamp: target.value }
}

async function render_ass_frame_preview_wrapper() {
	await render_ass_frame_preview(
		state,
		(new_state: Partial<ASSProcessingState>) => {
			state = { ...state, ...new_state }
		},
		(message: string) => {
			state = { ...state, message }
		},
		(error: string) => {
			state = { ...state, error_message: error }
		},
	)
}

async function process_ass_subtitles_wrapper() {
	await process_ass_subtitles(
		state,
		(new_state: Partial<ASSProcessingState>) => {
			state = { ...state, ...new_state }
		},
		(message: string) => {
			state = { ...state, message }
		},
		(error: string) => {
			state = { ...state, error_message: error }
		},
	)
}

function download_video_wrapper() {
	download_video(state.output_blob, state.output_url, state.video_file)
}

async function download_ass_file_wrapper() {
	if (!state.srt_file) {
		state = { ...state, error_message: "Please upload an SRT file first" }
		return
	}

	try {
		const srt_content = await state.srt_file.text()
		const ass_content = generate_ass_file(state, srt_content)

		const blob = new Blob([ass_content], { type: "text/plain" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `styled-subtitles-${state.video_file?.name.replace(/\.[^/.]+$/, "") || "video"}.ass`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)

		state = { ...state, message: "ASS file downloaded successfully" }
	} catch (error) {
		state = { ...state, error_message: `Failed to download ASS file: ${error}` }
	}
}

function reset_output_wrapper() {
	reset_output((new_state) => {
		state = { ...state, ...new_state }
	})
}
</script>

<div
	class="processor-container mx-auto max-w-6xl min-w-0 space-y-6 rounded-xl bg-white p-4 shadow-lg"
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
					disabled={state.is_processing}
				/>
			</div>
			{#if state.video_file}
				<p
					class="mt-1 inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
				>
					{state.video_file.name}
				</p>
			{/if}
		</div>

		<!-- SRT Upload -->
		<div class="mb-4">
			<label
				for="srt-upload"
				class="mb-2 block text-sm font-semibold text-gray-700"
				>SRT Subtitles</label
			>
			<div class="relative">
				<input
					id="srt-upload"
					type="file"
					accept=".srt"
					onchange={handle_srt_upload}
					class="w-full rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 transition-all duration-200 file:mr-2 file:rounded file:border-0 file:bg-green-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-green-700 hover:border-green-400 focus:ring-2 focus:ring-green-500 focus:outline-none"
					disabled={state.is_processing}
				/>
			</div>
			{#if state.srt_file}
				<p
					class="mt-1 inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
				>
					{state.srt_file.name}
				</p>
			{/if}
		</div>
	</div>

	<!-- Settings Section -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		<!-- Basic Font Settings -->
		<div
			class="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6"
		>
			<h2 class="mb-4 text-xl font-bold text-gray-800">
				Font Settings
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
						(f) => f.name === state.selected_font.name,
					)}
					onchange={handle_font_change}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					disabled={state.is_processing}
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
					>Font Size: {state.font_size}px</label
				>
				<input
					id="font-size"
					type="range"
					min="12"
					max="120"
					value={state.font_size}
					oninput={handle_font_size_change}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					disabled={state.is_processing}
				/>
			</div>
		</div>

		<!-- Text Color Settings -->
		<div
			class="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-6"
		>
			<h2 class="mb-4 text-xl font-bold text-gray-800">
				Text Colors
			</h2>

			<!-- Text Color -->
			<div class="mb-4">
				<label
					for="text-color"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Text Color</label
				>
				<div class="flex items-center space-x-3">
					<input
						id="text-color"
						type="color"
						value={state.text_color}
						onchange={handle_text_color_change}
						class="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
						disabled={state.is_processing}
					/>
					<span class="text-sm text-gray-600">{state.text_color}</span>
				</div>
			</div>

			<!-- Stroke Color -->
			<div class="mb-4">
				<label
					for="stroke-color"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Stroke Color</label
				>
				<div class="flex items-center space-x-3">
					<input
						id="stroke-color"
						type="color"
						value={state.stroke_color}
						onchange={handle_stroke_color_change}
						class="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
						disabled={state.is_processing}
					/>
					<span class="text-sm text-gray-600">{state.stroke_color}</span>
				</div>
			</div>

			<!-- Stroke Size -->
			<div class="mb-4">
				<label
					for="stroke-size"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Stroke Size: {state.stroke_size}px</label
				>
				<input
					id="stroke-size"
					type="range"
					min="0"
					max="10"
					value={state.stroke_size}
					oninput={handle_stroke_size_change}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
					disabled={state.is_processing}
				/>
			</div>
		</div>

		<!-- Shadow & Position Settings -->
		<div
			class="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6"
		>
			<h2 class="mb-4 text-xl font-bold text-gray-800">
				Shadow & Position
			</h2>

			<!-- Shadow Blur -->
			<div class="mb-4">
				<label
					for="shadow-blur"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Shadow Blur: {state.shadow_blur}px</label
				>
				<input
					id="shadow-blur"
					type="range"
					min="0"
					max="20"
					value={state.shadow_blur}
					oninput={handle_shadow_blur_change}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
					disabled={state.is_processing}
				/>
			</div>

			<!-- Shadow Opacity -->
			<div class="mb-4">
				<label
					for="shadow-opacity"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Shadow Opacity: {state.shadow_opacity}%</label
				>
				<input
					id="shadow-opacity"
					type="range"
					min="0"
					max="100"
					value={state.shadow_opacity}
					oninput={handle_shadow_opacity_change}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
					disabled={state.is_processing}
				/>
			</div>

			<!-- Position Y -->
			<div class="mb-4">
				<label
					for="position-y"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Vertical Position: {state.subtitle_position_y}px</label
				>
				<input
					id="position-y"
					type="range"
					min="0"
					max="1080"
					value={state.subtitle_position_y}
					oninput={handle_position_y_change}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
					disabled={state.is_processing}
				/>
			</div>
		</div>
	</div>

	<!-- Font Preview -->
	<div
		class="rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-6"
	>
		<h3 class="mb-4 text-lg font-bold text-gray-800">Font Preview</h3>
		<div class="overflow-hidden rounded-lg bg-white p-4 shadow-inner">
			<div
				class="mx-auto flex h-24 w-full max-w-md items-center justify-center"
			>
				<FontPreview
					font_name={state.selected_font.name}
					font_size={state.font_size}
					sample_text="The quick brown fox jumps over the lazy dog"
				/>
			</div>
		</div>
	</div>

	<!-- Frame Preview Section -->
	{#if state.video_file && state.srt_file}
		<div
			class="rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-6"
		>
			<h2 class="mb-4 text-xl font-bold text-gray-800">Frame Preview</h2>
			<div class="mb-6 flex flex-col items-center gap-4 sm:flex-row">
				<button
					onclick={render_ass_frame_preview_wrapper}
					disabled={state.is_processing || state.is_rendering_preview}
					class="max-w-xs flex-1 transform rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
				>
					{#if state.is_rendering_preview}
						<span class="flex items-center justify-center">
							Rendering...
							<div
								class="ml-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
							></div>
						</span>
					{:else}
						Render ASS Preview
					{/if}
				</button>
			</div>
			{#if state.preview_url}
				<div class="text-center">
					<div class="mx-auto max-w-4xl rounded-lg bg-black p-1">
						<img
							src={state.preview_url}
							alt="ASS frame preview with subtitles"
							class="w-full rounded-lg"
							style="max-height: 500px;"
						/>
					</div>
					<p
						class="mt-3 inline-block rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
					>
						Preview at {state.preview_timestamp}
					</p>
				</div>
			{:else}
				<div class="rounded-lg bg-gray-50 py-8 text-center">
					<p class="mb-2 text-lg text-gray-500">No preview yet</p>
					<p class="text-sm text-gray-400">
						Click "Render ASS Preview" to see how your styled subtitles
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
				value={state.selected_quality_mode}
				onchange={handle_quality_change}
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-green-500 focus:outline-none"
				disabled={state.is_processing}
			>
				<option value="preview">Preview</option>
				<option value="high">High Quality</option>
			</select>
		</div>

		<!-- Status Messages -->
		{#if state.error_message}
			<div
				class="mb-6 rounded-lg border-2 border-red-300 bg-red-50 px-5 py-4 text-red-800"
			>
				<div class="flex items-center">
					<span class="mr-3">!</span>
					<span>{state.error_message}</span>
				</div>
			</div>
		{/if}

		<!-- Message -->
		<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
			<p class="font-medium text-blue-800">{state.message}</p>
		</div>

		<!-- Progress Bar -->
		{#if state.is_processing || state.is_rendering_preview}
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
								>{state.progress}%</span
							>
						</div>
					</div>
					<div
						class="mb-4 flex h-2 overflow-hidden rounded-full bg-gray-200 text-xs"
					>
						<div
							style="width: {state.progress}%"
							class="flex flex-col justify-center bg-green-500 text-center whitespace-nowrap text-white shadow-none"
						></div>
					</div>
					{#if state.is_processing && state.processing_start_time}
						<div class="mt-2 text-center">
							<p class="text-xs text-gray-600">
								{format_time_remaining(
									state.processing_start_time,
									state.estimated_total_duration,
									state.progress
								)}
							</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Process Button -->
		<button
			onclick={process_ass_subtitles_wrapper}
			disabled={state.is_processing || !state.video_file || !state.srt_file}
			class="flex w-full transform items-center justify-center rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-8 py-4 text-xl font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-green-700 hover:to-green-800 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
		>
			{#if state.is_processing}
				<span class="flex items-center">
					<div
						class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
					></div>
					Processing with ASS Subtitles...
				</span>
			{:else}
				Burn ASS Subtitles to Video
			{/if}
		</button>
	</div>

	<!-- Output Section -->
	{#if state.output_url}
		<div
			class="space-y-6 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6"
		>
			<h2 class="text-2xl font-bold text-gray-800">ASS Output Ready!</h2>
			<div class="overflow-hidden rounded-xl bg-black shadow-2xl">
				<video
					src={state.output_url}
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
					onclick={download_ass_file_wrapper}
					class="flex flex-1 transform items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-purple-700 hover:to-purple-800 hover:shadow-xl"
				>
					Download ASS File
				</button>
				<button
					onclick={download_video_wrapper}
					class="flex flex-1 transform items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl"
				>
					Download Video
				</button>
				<button
					onclick={reset_output_wrapper}
					class="flex flex-1 transform items-center justify-center rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-gray-600 hover:to-gray-700 hover:shadow-xl"
				>
					Start Over
				</button>
			</div>
		</div>
	{:else if state.video_file && state.srt_file && !state.is_processing}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center"
		>
			<h3 class="mb-2 text-lg font-semibold text-gray-700">
				Ready to Process!
			</h3>
			<p class="text-gray-500">
				Configure your ASS subtitle styling above and click "Burn ASS Subtitles to Video" to create your styled subtitled video.
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
				Upload your video file and SRT subtitle file to begin creating styled ASS subtitled videos.
			</p>
			<div class="flex justify-center space-x-4 text-sm text-gray-400">
				<span>Video</span>
				<span class="text-gray-300">→</span>
				<span>SRT → ASS</span>
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