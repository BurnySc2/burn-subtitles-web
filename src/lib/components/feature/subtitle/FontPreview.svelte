<script lang="ts">
type FontPreviewProps = {
    font_name: string
    font_size: number
    font_weight?: "normal" | "bold"
    sample_text: string
}

let {
    font_name = "Noto Sans",
    font_size = 16,
    font_weight = "normal",
    sample_text = "Sample text",
}: FontPreviewProps = $props()
</script>

<div class="flex flex-col w-full">
    <label
        for="sample-text"
        class="form-label"
        >Preview text</label
    >
    <textarea
        id="sample-text"
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
    class="btn btn-primary btn-sm mt-2"
    disabled={sample_text === "The quick brown fox jumps over the lazy dog"}
>
    Reset Text
</button>
