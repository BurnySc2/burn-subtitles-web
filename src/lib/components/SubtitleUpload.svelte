<script lang="ts">
	import { update_state } from '../stores/subtitle-store.svelte'

	let video_input = $state(null as HTMLInputElement | null)
	let srt_input = $state(null as HTMLInputElement | null)
	let drag_over = $state(false)
	let srt_drag_over = $state(false)

	function handle_video_upload(event: Event) {
		const target = event.target as HTMLInputElement
		const file = target.files?.[0]
		if (file && file.type.startsWith('video/')) {
			update_state({ video_file: file })
			target.value = ''
		} else if (file) {
			update_state({ error: 'Please select a valid video file (mp4, avi, mov, etc.)' })
			target.value = ''
		}
	}

	function handle_video_drop(event: DragEvent) {
		event.preventDefault()
		drag_over = false
		const files = event.dataTransfer?.files
		if (files && files.length > 0) {
			const file = files[0]
			if (file.type.startsWith('video/')) {
				update_state({ video_file: file })
				if (video_input) {
					const dt = new DataTransfer()
					dt.items.add(file)
					video_input.files = dt.files
				}
			} else {
				update_state({ error: 'Please drop a valid video file (mp4, avi, mov, etc.)' })
			}
		}
	}

	function handle_drag_over(event: DragEvent) {
		event.preventDefault()
		drag_over = true
	}

	function handle_drag_leave(event: DragEvent) {
		drag_over = false
	}

	function handle_srt_drop(event: DragEvent) {
		event.preventDefault()
		srt_drag_over = false
		const files = event.dataTransfer?.files
		if (files && files.length > 0) {
			const file = files[0]
			if (file.name.endsWith('.srt')) {
				update_state({ srt_file: file })
				if (srt_input) {
					const dt = new DataTransfer()
					dt.items.add(file)
					srt_input.files = dt.files
				}
			} else {
				update_state({ error: 'Please drop a valid SRT subtitle file' })
			}
		}
	}

	function handle_srt_drag_over(event: DragEvent) {
		event.preventDefault()
		srt_drag_over = true
	}

	function handle_srt_drag_leave(event: DragEvent) {
		srt_drag_over = false
	}

	function handle_srt_upload(event: Event) {
		const target = event.target as HTMLInputElement
		const file = target.files?.[0]
		if (file && file.name.endsWith('.srt')) {
			update_state({ srt_file: file })
			target.value = ''
		} else if (file) {
			update_state({ error: 'Please select a valid SRT subtitle file' })
			target.value = ''
		}
	}

	function clear_files() {
		if (video_input) video_input.value = ''
		if (srt_input) srt_input.value = ''
		update_state({ video_file: null, srt_file: null })
	}
</script>

<div class="upload-container rounded-lg bg-gray-50 p-6">
	<h2 class="mb-4 text-xl font-bold">Upload Files</h2>

	<div class="space-y-4">
		<div>
			<label for="video" class="mb-2 block text-sm font-medium text-gray-700">Video File</label>
			<input
				id="video"
				type="file"
				accept="video/*"
				onchange={handle_video_upload}
				ondrop={handle_video_drop}
				ondragover={handle_drag_over}
				ondragleave={handle_drag_leave}
				bind:this={video_input}
				class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 {drag_over
					? 'border-2 border-blue-500 bg-blue-50'
					: ''}"
			/>
			{#if video_input?.value && video_input.value.trim()}
				<p class="mt-2 text-sm text-gray-600">
					Selected: {video_input.value.split(/[\\/]/).pop()}
				</p>
			{:else}
				<p class="mt-2 text-sm text-gray-500 italic">Or drag and drop a video file here</p>
			{/if}
		</div>

		<div>
			<label for="srt" class="mb-2 block text-sm font-medium text-gray-700">SRT Subtitle File</label>
			<input
				id="srt"
				type="file"
				accept=".srt"
				onchange={handle_srt_upload}
				ondrop={handle_srt_drop}
				ondragover={handle_srt_drag_over}
				ondragleave={handle_srt_drag_leave}
				bind:this={srt_input}
				class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-green-700 hover:file:bg-green-100 {srt_drag_over
					? 'border-2 border-green-500 bg-green-50'
					: ''}"
			/>
			{#if srt_input?.value && srt_input.value.trim()}
				<p class="mt-2 text-sm text-gray-600">
					Selected: {srt_input.value.split(/[\\/]/).pop()}
				</p>
			{:else}
				<p class="mt-2 text-sm text-gray-500 italic">Or drag and drop an SRT file here</p>
			{/if}
		</div>

		{#if video_input?.value || srt_input?.value}
			<button onclick={clear_files} class="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600">
				Clear Files
			</button>
		{/if}
	</div>
</div>

<style>
	.upload-container {
		max-width: 500px;
	}
</style>
