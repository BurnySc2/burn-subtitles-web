<script lang="ts">
	import { app_state, update_state } from '../stores/subtitle-store.svelte'

	let preview_text = $state('The quick brown fox jumps over the lazy dog.')
</script>

<div class="font-preview-container mb-6 rounded-lg bg-gray-50 p-6">
	<h3 class="mb-4 text-lg font-semibold text-gray-800">Font Preview</h3>

	<!-- Preview Text Input -->
	<div class="mb-4">
		<label class="mb-2 block text-sm font-medium text-gray-700">Preview Text</label>
		<div class="flex items-center space-x-2">
			<textarea
				bind:value={preview_text}
				rows="3"
				placeholder="Enter text to preview (supports Asian/Arabic characters)"
				class="flex-1 resize-none rounded border border-gray-300 p-3 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
				style="font-family: {app_state.subtitle_settings.font_family}, sans-serif; font-size: {app_state
					.subtitle_settings.font_size}px; line-height: 1.4;"
				disabled={app_state.is_processing}
			></textarea>
			<button
				onclick={() => (preview_text = 'The quick brown fox jumps over the lazy dog.')}
				class="rounded bg-gray-200 px-3 py-2 text-sm whitespace-nowrap hover:bg-gray-300 disabled:opacity-50"
				disabled={app_state.is_processing}
			>
				Reset
			</button>
		</div>
		<p class="mt-1 text-xs text-gray-500">
			Current: {app_state.subtitle_settings.font_family} | Size: {app_state.subtitle_settings.font_size}px | Bold: {app_state
				.subtitle_settings.bold
				? 'Yes'
				: 'No'}
		</p>
	</div>
</div>

<style>
	.font-preview-container {
		max-width: 600px;
		border: 1px solid #e5e7eb;
	}

	.slider::-webkit-slider-thumb {
		appearance: none;
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
	}

	.slider::-moz-range-thumb {
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: none;
	}
</style>
