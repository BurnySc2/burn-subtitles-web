type Position = 'top' | 'bottom' | 'center'

type SubtitleSettings = {
	font_family: string
	font_size: number
	bold: boolean
	position: Position
}

type AppState = {
	subtitle_settings: SubtitleSettings
	video_file: File | null
	srt_file: File | null
	is_processing: boolean
	error: string | null
	output_blob: Blob | null
	progress: number
}

const initial_state: AppState = {
	subtitle_settings: {
		font_family: 'Arial',
		font_size: 24,
		bold: false,
		position: 'bottom'
	},
	video_file: null,
	srt_file: null,
	is_processing: false,
	error: null,
	output_blob: null,
	progress: 0
}

export let app_state = $state(initial_state)

// Function to update state (reactive)
export function update_state(updates: Partial<AppState>) {
	Object.assign(app_state, updates)
}

// Reset function
export function reset_state() {
	Object.assign(app_state, initial_state)
}

// Get available fonts (will be used in config component)
export function get_available_fonts(): Promise<string[]> {
	return document.fonts.ready.then(() => {
		return Array.from(document.fonts).map((font) => font.family)
	})
}
