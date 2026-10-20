<script lang="ts">
import { format_dual_size } from "$lib/utils/format_size"

export interface TransitionResultData {
    url: string
    mime: string
    ext: string
    size_bytes: number
    duration: string
}

let { result, filename }: { result: TransitionResultData; filename: string } = $props()
</script>

<div class="rounded-lg bg-gray-100 p-4">
    <h2 class="mb-3 text-lg font-semibold">Transition ready</h2>
    <video
        src={result.url}
        controls
        class="mb-4 w-full rounded"
    >
        <track kind="captions">
    </video>
    <p class="mb-4 text-sm text-gray-600">
        Duration {result.duration} · {format_dual_size(result.size_bytes, 2)} · {result.mime}
    </p>
    <a
        href={result.url}
        download={filename}
        class="block w-full rounded bg-green-600 px-6 py-3 text-center text-white transition-colors hover:bg-green-700"
    >
        Download Transition
    </a>
</div>
