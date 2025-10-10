<script lang="ts">
import { app_state, update_state } from "../stores/subtitle-store.svelte"

let available_fonts = $state<string[]>([])
let is_loading_fonts = $state(true)
let is_loading_selected_font = $state(false)
let selected_font = $state("")

// Track loaded fonts to avoid duplicate requests
let loaded_fonts = $state<Set<string>>(new Set())

$effect(() => {
	async function load_google_fonts() {
		try {
			is_loading_fonts = true
			// Fetch popular Google Fonts CSS including non-Latin scripts
			const response = await fetch(
				"https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Lato:wght@400;700&family=Montserrat:wght@400;700&family=Poppins:wght@400;700&family=Source+Sans+Pro:wght@400;700&family=Nunito:wght@400;700&family=Raleway:wght@400;700&family=PT+Sans:wght@400;700&family=Ubuntu:wght@400;700&family=Merriweather:wght@400;700&family=Playfair+Display:wght@400;700&family=Work+Sans:wght@400;700&family=Fira+Sans:wght@400;700&family=Quicksand:wght@400;700&family=Roboto+Slab:wght@400;700&family=Oswald:wght@400;700&family=PT+Serif:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Crimson+Text:wght@400;700&family=Source+Serif+Pro:wght@400;700&family=EB+Garamond:wght@400;700&family=DM+Serif+Display:wght@400;700&family=Space+Grotesk:wght@400;700&family=Inter+Tight:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Space+Mono:wght@400;700&family=Inconsolata:wght@400;700&family=IBM+Plex+Mono:wght@400;700&family=Anonymous+Pro:wght@400;700&family=Source+Code+Pro:wght@400;700&family=Roboto+Mono:wght@400;700&family=Fira+Code:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Amiri:wght@400;700&family=Scheherazade+New:wght@400;700&family=Cairo:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Source+Han+Sans:wght@400;700&family=Noto+Serif:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Bengali:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&family=Noto+Sans+Khmer:wght@400;700&family=Noto+Sans+Lao:wght@400;700&display=swap",
			)
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`)
			}
			const css_text = await response.text()

			// Parse CSS to extract font-family names
			const font_families = new Set<string>()
			const font_matches = css_text.match(/font-family:\s*['"]?([^'";]+)['"]?(?:;|$)/g)
			if (font_matches) {
				font_matches.forEach((match) => {
					const family = match
						.replace(/font-family:\s*['"]?/, "")
						.replace(/['"]?(?:;|$)/, "")
						.trim()
					if (family && !family.includes(",")) {
						// Skip fallback fonts
						font_families.add(family)
					}
				})
			}

			available_fonts = Array.from(font_families).sort()
			is_loading_fonts = false

			// Set initial selected font if available
			const current_font = app_state.subtitle_settings.font_family
			if (available_fonts.includes(current_font)) {
				selected_font = current_font
			} else {
				selected_font = available_fonts[0] || "Roboto"
			}
		} catch (error) {
			console.error("Failed to load Google Fonts:", error)
			// Fallback to system fonts
			available_fonts = [
				"Arial",
				"Helvetica",
				"Times New Roman",
				"Courier New",
				"Verdana",
				"Georgia",
				"Palatino",
				"Garamond",
				"Bookman",
				"Comic Sans MS",
				"Trebuchet MS",
				"Arial Black",
				"Impact",
			].sort()
			is_loading_fonts = false
			selected_font = available_fonts[0] || "Roboto"
		}
	}

	load_google_fonts()
})

// Load selected font CSS when it changes
$effect(() => {
	const current_font = app_state.subtitle_settings.font_family
	if (current_font && !loaded_fonts.has(current_font) && !is_loading_selected_font) {
		async function load_font_css() {
			try {
				is_loading_selected_font = true
				// Replace spaces and special characters for Google Fonts URL
				const font_name = current_font.replace(/'/g, "").replace(/ /g, "+")
				const font_url = `https://fonts.googleapis.com/css2?family=${font_name}:wght@400;700&display=swap`

				const link = document.createElement("link")
				link.rel = "stylesheet"
				link.href = font_url
				document.head.appendChild(link)

				// Wait for font to load
				await document.fonts.load(`400 16px ${current_font}`)
				await document.fonts.load(`700 16px ${current_font}`)

				loaded_fonts.add(current_font)
				is_loading_selected_font = false
				console.log(`Loaded font: ${current_font}`)
			} catch (error) {
				console.warn(`Failed to load font ${current_font}:`, error)
				is_loading_selected_font = false
			}
		}

		load_font_css()
	}
})

// Sync selected_font with app_state changes
$effect(() => {
	const current_font = app_state.subtitle_settings.font_family
	if (available_fonts.includes(current_font)) {
		selected_font = current_font
	}
})

// Update font when selection changes
function handle_font_change(event: Event) {
	const target = event.target as HTMLSelectElement
	const new_font = target.value
	update_state({
		subtitle_settings: {
			...app_state.subtitle_settings,
			font_family: new_font,
		},
	})
	selected_font = new_font
}

// Update size
function handle_size_change(event: Event) {
	const target = event.target as HTMLInputElement
	const new_size = parseInt(target.value, 10)
	if (!isNaN(new_size) && new_size > 0) {
		update_state({
			subtitle_settings: {
				...app_state.subtitle_settings,
				font_size: new_size,
			},
		})
	}
}

// Update bold
function handle_bold_change(event: Event) {
	const target = event.target as HTMLInputElement
	update_state({
		subtitle_settings: {
			...app_state.subtitle_settings,
			bold: target.checked,
		},
	})
}

// Update position
function handle_position_change(event: Event) {
	const target = event.target as HTMLSelectElement
	const new_position = target.value as "top" | "bottom" | "center"
	update_state({
		subtitle_settings: {
			...app_state.subtitle_settings,
			position: new_position,
		},
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
