<script lang="ts">
let {
    url,
    hasVideo,
    onDuration,
    onError,
}: {
    url: string
    hasVideo: boolean
    onDuration?: (duration: number) => void
    onError?: () => void
} = $props()

function handle_loaded(event: Event) {
    const el = event.currentTarget as HTMLVideoElement | HTMLAudioElement
    if (Number.isFinite(el.duration)) {
        onDuration?.(el.duration)
    }
}
</script>

{#if hasVideo}
    <video
        src={url}
        controls
        class="w-full rounded"
        onloadedmetadata={handle_loaded}
        onerror={() => onError?.()}
    >
        <track kind="captions">
    </video>
{:else}
    <audio
        src={url}
        controls
        class="w-full"
        onloadedmetadata={handle_loaded}
        onerror={() => onError?.()}
    ></audio>
{/if}
