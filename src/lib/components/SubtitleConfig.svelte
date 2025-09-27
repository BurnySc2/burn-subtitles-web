<script lang="ts">
	import { app_state, update_state } from '../stores/subtitle-store.svelte'

	let available_fonts = $state<string[]>([])
	let is_loading_fonts = $state(true)
	let selected_font = $state('')

	$effect(() => {
		// Simulate loading completion immediately since we're using predefined fonts
		setTimeout(() => {
			available_fonts = [
				'Arial',
				'Helvetica',
				'Times New Roman',
				'Courier New',
				'Verdana',
				'Georgia',
				'Palatino',
				'Garamond',
				'Bookman',
				'Comic Sans MS',
				'Trebuchet MS',
				'Arial Black',
				'Impact'
			].sort()
			is_loading_fonts = false
			// Set initial selected font if available
			const current_font = app_state.subtitle_settings.font_family
			if (available_fonts.includes(current_font)) {
				selected_font = current_font
			} else {
				selected_font = available_fonts[0] || 'Arial'
			}
		}, 100) // Brief delay to show loading state
	})

	// Update font when selection changes
	function handle_font_change(event: Event) {
		const target = event.target as HTMLSelectElement
		const new_font = target.value
		update_state({
			subtitle_settings: {
				...app_state.subtitle_settings,
				font_family: new_font
			}
		})
	}

	// Update size
	function handle_size_change(event: Event) {
		const target = event.target as HTMLInputElement
		const new_size = parseInt(target.value, 10)
		if (!isNaN(new_size) && new_size > 0) {
			update_state({
				subtitle_settings: {
					...app_state.subtitle_settings,
					font_size: new_size
				}
			})
		}
	}

	// Update bold
	function handle_bold_change(event: Event) {
		const target = event.target as HTMLInputElement
		update_state({
			subtitle_settings: {
				...app_state.subtitle_settings,
				bold: target.checked
			}
		})
	}

	// Update position
	function handle_position_change(event: Event) {
		const target = event.target as HTMLSelectElement
		const new_position = target.value as 'top' | 'bottom' | 'center'
		update_state({
			subtitle_settings: {
				...app_state.subtitle_settings,
				position: new_position
			}
		})
	}
</script>

<div class="config-container rounded-lg bg-blue-50 p-6">
	<h2 class="mb-4 text-xl font-bold">Subtitle Configuration</h2>

	{#if is_loading_fonts}
		<p class="text-gray-500">Loading available fonts...</p>
	{:else}
		<div class="space-y-4">
			<div>
				<label for="font" class="mb-2 block text-sm font-medium text-gray-700">Font Family</label>
				<select
					id="font"
					value={selected_font}
					onchange={handle_font_change}
					class="block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
					disabled={!available_fonts.length}
				>
					{#each available_fonts as font}
						<option value={font}>{font}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="size" class="mb-2 block text-sm font-medium text-gray-700">Font Size</label>
				<input
					id="size"
					type="number"
					value={app_state.subtitle_settings.font_size}
					oninput={handle_size_change}
					min="8"
					max="100"
					class="block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>

			<div class="flex items-center">
				<input
					id="bold"
					type="checkbox"
					checked={app_state.subtitle_settings.bold}
					onchange={handle_bold_change}
					class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
				/>
				<label for="bold" class="ml-2 block text-sm text-gray-700">Bold</label>
			</div>

			<div>
				<label for="position" class="mb-2 block text-sm font-medium text-gray-700">Position</label>
				<select
					id="position"
					value={app_state.subtitle_settings.position}
					onchange={handle_position_change}
					class="block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
				>
					<option value="top">Top</option>
					<option value="bottom">Bottom</option>
					<option value="center">Center</option>
				</select>
			</div>
		</div>
	{/if}
</div>

<style>
	.config-container {
		max-width: 400px;
	}
</style>
