<script lang="ts">
let {
    url,
    has_video,
    on_duration,
    on_error,
}: {
    url: string
    has_video: boolean
    on_duration?: (duration: number) => void
    on_error?: () => void
} = $props()

function handle_loaded(event: Event) {
    const el = event.currentTarget as HTMLVideoElement | HTMLAudioElement
    if (Number.isFinite(el.duration)) {
        on_duration?.(el.duration)
    }
}
</script>

{#if has_video}
    <video
        src={url}
        controls
        class="w-full rounded"
        onloadedmetadata={handle_loaded}
        onerror={() => on_error?.()}
    >
        <track kind="captions">
    </video>
{:else}
    <audio
        src={url}
        controls
        class="w-full"
        onloadedmetadata={handle_loaded}
        onerror={() => on_error?.()}
    >
        <track kind="captions">
    </audio>
{/if}
