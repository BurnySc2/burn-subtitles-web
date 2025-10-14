<script lang="ts">
type FontPreviewProps = {
	font_name: string
	font_size: number
	sample_text: string
}

let { font_name = "Arial", font_size = 16, sample_text = "Sample text" }: FontPreviewProps = $props()
</script>

<div class="flex flex-col">
	<textarea
		bind:value={sample_text}
		placeholder="Enter sample text..."
		class="w-full rounded border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
		style="font-family: {font_name}; font-size: {font_size}px;"
		rows={3}
	></textarea>
	<div class="mt-2 text-xs text-gray-500">
		Preview: {font_name} at {font_size}px
	</div>
</div>

<button
	onclick={() => {
		sample_text = "The quick brown fox jumps over the lazy dog";
	}}
	class="mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
>
	Reset Text
</button>

<style>
	.font-preview {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
	}
</style>
