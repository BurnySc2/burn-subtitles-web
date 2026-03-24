<script lang="ts">
type FontPreviewProps = {
    font_name: string
    font_size: number
    font_weight?: "normal" | "bold"
    sample_text: string
}

let {
    font_name = "Arial",
    font_size = 16,
    font_weight = "normal",
    sample_text = "Sample text",
}: FontPreviewProps = $props()
</script>

<div class="flex flex-col w-full">
    <textarea
        bind:value={sample_text}
        placeholder="Enter sample text..."
        class="w-full rounded border border-gray-300 p-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        style="font-family: {font_name}; font-weight: {font_weight}; font-size: {font_size}px;"
        rows={2}
    ></textarea>
    <div class="mt-1 text-xs text-gray-500">Preview: {font_name} ({font_weight}) at {font_size}px</div>
</div>

<button
    onclick={() => {
 		sample_text = "The quick brown fox jumps over the lazy dog"
 	}}
    class="mt-2 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
    disabled={sample_text === "The quick brown fox jumps over the lazy dog"}
>
    Reset Text
</button>
