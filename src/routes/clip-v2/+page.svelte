<script lang="ts">
import ClipV2Extractor from "$lib/components/feature/clip-v2/ClipV2Extractor.svelte"
</script>

<div class="flex flex-col items-center py-8">
    <h1 class="mb-2 text-2xl font-bold">Clip (v2)</h1>
    <a
        href="/clip"
        class="mb-4 text-sm text-blue-600 underline"
        >Back to /clip v1 fallback</a
    >
    <ClipV2Extractor />
</div>
