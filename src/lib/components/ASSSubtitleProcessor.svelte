<script lang="ts">
// See http://www.tcax.org/docs/ass-specs.htm
import {
	type ASSProcessingState,
	available_fonts,
	create_initial_state,
	download_video,
	format_time_remaining,
	generate_ass_file,
	process_ass_subtitles,
	render_ass_frame_preview,
	reset_output,
} from "$lib/utils/subtitle-processing"
import FontPreview from "./FontPreview.svelte"

let my_state = $state<ASSProcessingState>({
	...create_initial_state(),
	text_color: "#ffff7f",
	font_size: 24,
	stroke_size: 1,
	stroke_color: "#000000",
	shadow_blur: 0,
	subtitle_horizontal_margin: 30,
	subtitle_position_y: 0,
	subtitle_center_x: 960,
	RTL: false,
})

let sample_text = $state("The quick brown fox jumps over the lazy dog")

function handle_video_upload(event: Event) {
	const target = event.target as HTMLInputElement
	if (target.files?.[0]) {
		my_state = { ...my_state, video_file: target.files[0] }
		if (my_state.preview_url) {
			URL.revokeObjectURL(my_state.preview_url)
			my_state = { ...my_state, preview_url: null }
		}
	}
}

function handle_srt_upload(event: Event) {
	const target = event.target as HTMLInputElement
	if (target.files?.[0]) {
		my_state = { ...my_state, srt_file: target.files[0] }
		if (my_state.preview_url) {
			URL.revokeObjectURL(my_state.preview_url)
			my_state = { ...my_state, preview_url: null }
		}
	}
}

async function render_ass_frame_preview_wrapper() {
	await render_ass_frame_preview(
		my_state,
		(new_state: Partial<ASSProcessingState>) => {
			my_state = { ...my_state, ...new_state }
		},
		(message: string) => {
			my_state = { ...my_state, message }
		},
		(error: string) => {
			my_state = { ...my_state, error_message: error }
		},
	)
}

async function process_ass_subtitles_wrapper() {
	my_state.processing_start_time = Date.now()
	await process_ass_subtitles(
		my_state,
		(new_state: Partial<ASSProcessingState>) => {
			my_state = { ...my_state, ...new_state }
		},
		(message: string) => {
			my_state = { ...my_state, message }
		},
		(error: string) => {
			my_state = { ...my_state, error_message: error }
		},
	)
}

function download_video_wrapper() {
	download_video(my_state.output_blob, my_state.output_url, my_state.video_file)
}

async function download_ass_file_wrapper() {
	if (!my_state.srt_file) {
		my_state = {
			...my_state,
			error_message: "Please upload an SRT file first",
		}
		return
	}

	try {
		const srt_content = await my_state.srt_file.text()
		const ass_content = generate_ass_file(my_state, srt_content)

		const blob = new Blob([ass_content], { type: "text/plain" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `styled-subtitles-${my_state.video_file?.name.replace(/\.[^/.]+$/, "") || "video"}.ass`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)

		my_state = {
			...my_state,
			message: "ASS file downloaded successfully",
		}
	} catch (error) {
		my_state = {
			...my_state,
			error_message: `Failed to download ASS file: ${error}`,
		}
	}
}

function reset_output_wrapper() {
	reset_output((new_state) => {
		my_state = { ...my_state, ...new_state }
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
					disabled={my_state.is_processing}
				/>
			</div>
			{#if my_state.video_file}
				<p
					class="mt-1 inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
				>
					{my_state.video_file.name}
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
					disabled={my_state.is_processing}
				/>
			</div>
			{#if my_state.srt_file}
				<p
					class="mt-1 inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
				>
					{my_state.srt_file.name}
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
			<h2 class="mb-4 text-xl font-bold text-gray-800">Font Settings</h2>

			<!-- Font Selection -->
			<div class="mb-4">
				<label
					for="font-select"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Font Family</label
				>
				<select
					id="font-select"
					bind:value={my_state.selected_font_index}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					disabled={my_state.is_processing}
				>
					{#each available_fonts as font, index}
						<option value={index}>{font.select_name}</option>
					{/each}
				</select>
			</div>

			<!-- Font Size -->
			<div class="mb-4">
				<label
					for="font-size"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Font Size: {my_state.font_size}px</label
				>
				<input
					id="font-size"
					type="range"
					min="12"
					max="120"
					bind:value={my_state.font_size}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					disabled={my_state.is_processing}
				/>
			</div>

			<!-- RTL Support -->
			<div class="mb-4">
				<label class="flex items-center space-x-3">
					<input
						type="checkbox"
						bind:checked={my_state.RTL}
						class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						disabled={my_state.is_processing}
					/>
					<span class="text-sm font-semibold text-gray-700"
						>Enable Right-to-Left (RTL) Text</span
					>
				</label>
			</div>
		</div>

		<!-- Text Color Settings -->
		<div
			class="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-6"
		>
			<h2 class="mb-4 text-xl font-bold text-gray-800">Text Colors</h2>

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
						bind:value={my_state.text_color}
						class="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
						disabled={my_state.is_processing}
					/>
					<span class="text-sm text-gray-600"
						>{my_state.text_color}</span
					>
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
						bind:value={my_state.stroke_color}
						class="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
						disabled={my_state.is_processing}
					/>
					<span class="text-sm text-gray-600"
						>{my_state.stroke_color}</span
					>
				</div>
			</div>

			<!-- Stroke Size -->
			<div class="mb-4">
				<label
					for="stroke-size"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Outline Size: {my_state.stroke_size}px</label
				>
				<input
					id="stroke-size"
					type="range"
					min="0"
					max="10"
					bind:value={my_state.stroke_size}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
					disabled={my_state.is_processing}
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
					>Shadow: {my_state.shadow_blur}px</label
				>
				<input
					id="shadow-blur"
					type="range"
					min="0"
					max="4"
					bind:value={my_state.shadow_blur}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
					disabled={my_state.is_processing}
				/>
			</div>

			<!-- Horizontal Margin -->
			<div class="mb-4">
				<label
					for="position-y"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Horizontal Margin: {my_state.subtitle_horizontal_margin}px</label
				>
				<input
					id="margin-h"
					type="range"
					min="0"
					max="1080"
					bind:value={my_state.subtitle_horizontal_margin}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
					disabled={my_state.is_processing}
				/>
			</div>

			<!-- Vertical Anchor -->
			<div class="mb-4">
				<label
					for="anchor-y"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Vertical Anchor</label
				>
				<select
					id="anchor-y"
					bind:value={my_state.position}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					disabled={my_state.is_processing}
				>
					{#each ["Top", "Center", "Bottom"] as anchor_option}
						<option value={anchor_option.toLowerCase()}
							>{anchor_option}</option
						>
					{/each}
				</select>
			</div>

			<!-- Position Y -->
			{#if my_state.position !== "center"}
				<div class="mb-4">
					<label
						for="position-y"
						class="mb-2 block text-sm font-semibold text-gray-700"
						>Vertical Position: {my_state.subtitle_position_y}px</label
					>
					<input
						id="position-y"
						type="range"
						min="0"
						max="1080"
						bind:value={my_state.subtitle_position_y}
						class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
						disabled={my_state.is_processing}
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- Font Preview -->
	<div
		class="rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-6"
	>
		<h3 class="mb-4 text-lg font-bold text-gray-800">Font Preview</h3>
		<div class="rounded-lg bg-white p-2 shadow-inner">
			<div
				class="mx-auto flex w-full items-center justify-center space-x-4"
			>
				<FontPreview
					font_name={available_fonts[my_state.selected_font_index]
						.font_family}
					font_size={my_state.font_size}
					{sample_text}
					font_weight={available_fonts[my_state.selected_font_index]
						.font_weight}
				/>
			</div>
		</div>
	</div>

	<!-- Frame Preview Section -->
	{#if my_state.video_file && my_state.srt_file}
		<div
			class="rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-6"
		>
			<h2 class="mb-4 text-xl font-bold text-gray-800">Frame Preview</h2>
			<!-- Preview Timestamp Input -->
			<div class="mb-6">
				<label
					for="preview-timestamp"
					class="mb-2 block text-sm font-semibold text-gray-700"
					>Preview Timestamp</label
				>
				<div class="flex items-center space-x-3">
					<input
						id="preview-timestamp"
						type="text"
						bind:value={my_state.preview_timestamp}
						placeholder="00:00:00"
						class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
						disabled={my_state.is_processing ||
							my_state.is_rendering_preview}
					/>
					<button
						onclick={render_ass_frame_preview_wrapper}
						disabled={my_state.is_processing ||
							my_state.is_rendering_preview}
						class="transform rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
					>
						{#if my_state.is_rendering_preview}
							<span class="flex items-center justify-center">
								Rendering...
								<div
									class="ml-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
								></div>
							</span>
						{:else}
							Render Preview
						{/if}
					</button>
				</div>
			</div>
			{#if my_state.preview_url}
				<div class="text-center">
					<div class="mx-auto max-w-4xl rounded-lg bg-black p-1">
						<img
							src={my_state.preview_url}
							alt="ASS frame preview with subtitles"
							class="w-full rounded-lg"
							style="max-height: 500px;"
						/>
					</div>
					<p
						class="mt-3 inline-block rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
					>
						Preview at {my_state.preview_timestamp}
					</p>
				</div>
			{:else}
				<div class="rounded-lg bg-gray-50 py-8 text-center">
					<p class="mb-2 text-lg text-gray-500">No preview yet</p>
					<p class="text-sm text-gray-400">
						Click "Render ASS Preview" to see how your styled
						subtitles will look on the video frame.
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
				bind:value={my_state.selected_quality_mode}
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus:ring-2 focus:ring-green-500 focus:outline-none"
				disabled={my_state.is_processing}
			>
				<option value="preview">Preview</option>
				<option value="high">High Quality</option>
			</select>
		</div>

		<!-- Status Messages -->
		{#if my_state.error_message}
			<div
				class="mb-6 rounded-lg border-2 border-red-300 bg-red-50 px-5 py-4 text-red-800"
			>
				<div class="flex items-center">
					<span class="mr-3">!</span>
					<span>{my_state.error_message}</span>
				</div>
			</div>
		{/if}

		<!-- Message -->
		<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
			<p class="font-medium text-blue-800">{my_state.message}</p>
		</div>

		<!-- Progress Bar -->
		{#if my_state.is_processing || my_state.is_rendering_preview}
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
								>{my_state.progress}%</span
							>
						</div>
					</div>
					<div
						class="mb-4 flex h-2 overflow-hidden rounded-full bg-gray-200 text-xs"
					>
						<div
							style="width: {my_state.progress}%"
							class="flex flex-col justify-center bg-green-500 text-center whitespace-nowrap text-white shadow-none"
						></div>
					</div>
					{#if my_state.is_processing && my_state.processing_start_time}
						<div class="mt-2 text-center">
							<p class="text-xs text-gray-600">
								{format_time_remaining(
									my_state.processing_start_time,
									my_state.progress,
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
			disabled={my_state.is_processing ||
				!my_state.video_file ||
				!my_state.srt_file}
			class="flex w-full transform items-center justify-center rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-8 py-4 text-xl font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:from-green-700 hover:to-green-800 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
		>
			{#if my_state.is_processing}
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
	{#if my_state.output_url}
		<div
			class="space-y-6 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6"
		>
			<h2 class="text-2xl font-bold text-gray-800">ASS Output Ready!</h2>
			<div class="overflow-hidden rounded-xl bg-black shadow-2xl">
				<video
					src={my_state.output_url}
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
	{:else if my_state.video_file && my_state.srt_file && !my_state.is_processing}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center"
		>
			<h3 class="mb-2 text-lg font-semibold text-gray-700">
				Ready to Process!
			</h3>
			<p class="text-gray-500">
				Configure your ASS subtitle styling above and click "Burn ASS
				Subtitles to Video" to create your styled subtitled video.
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
				styled ASS subtitled videos.
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
