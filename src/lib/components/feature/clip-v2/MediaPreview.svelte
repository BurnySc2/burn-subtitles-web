<script lang="ts">
let {
    url,
    has_video,
    on_duration,
    on_error,
    on_time,
}: {
    url: string
    has_video: boolean
    on_duration?: (duration: number) => void
    on_error?: () => void
    on_time?: (time: number | null) => void
} = $props()

function handle_loaded(event: Event) {
    const el = event.currentTarget as HTMLVideoElement | HTMLAudioElement
    if (Number.isFinite(el.duration)) {
        on_duration?.(el.duration)
    }
}

function handle_time(event: Event) {
    const el = event.currentTarget as HTMLVideoElement | HTMLAudioElement
    on_time?.(Number.isFinite(el.currentTime) ? el.currentTime : null)
}
</script>

{#if has_video}
    <video
        src={url}
        controls
        class="w-full rounded"
        onloadedmetadata={handle_loaded}
        ontimeupdate={handle_time}
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
        ontimeupdate={handle_time}
        onerror={() => on_error?.()}
    >
        <track kind="captions">
    </audio>
{/if}
