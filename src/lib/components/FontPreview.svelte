<script lang="ts">
type FontPreviewProps = {
	font_name: string
	font_size: number
	sample_text: string
}

let { font_name = "Arial", font_size = 16, sample_text = "Sample text" }: FontPreviewProps = $props()
</script>

<div class="font-preview rounded border p-4">
	<p style="font-family: {font_name}, sans-serif; font-size: {font_size}px;" class="text-gray-800">
		{sample_text}
	</p>
	<div class="mt-2 text-xs text-gray-500">
		Preview: {font_name} at {font_size}px
	</div>
</div>

<style>
	.font-preview {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
	}
</style>
