<script lang="ts">
let {
    video_ref,
    wrapper_ref,
    url,
    has_video,
    on_tick,
    on_duration,
    on_error,
    on_seeked,
}: {
    video_ref: (el: HTMLVideoElement | HTMLAudioElement | null) => void
    wrapper_ref: (el: HTMLDivElement | null) => void
    url: string
    has_video: boolean
    on_tick: (t: { media_time: number; presented_frames?: number }) => void
    on_duration?: (d: number) => void
    on_error?: () => void
    on_seeked?: (t: number) => void
} = $props()

let video_el: HTMLVideoElement | null = $state(null)
let audio_el: HTMLAudioElement | null = $state(null)
let wrapper_el: HTMLDivElement | null = $state(null)

type RvfcCallback = (now: number, metadata: { mediaTime: number; presentedFrames: number }) => void

type RvfcVideoElement = HTMLVideoElement & {
    requestVideoFrameCallback: (callback: RvfcCallback) => number
    cancelVideoFrameCallback: (handle: number) => void
}

function handle_loaded(event: Event) {
    const el = event.currentTarget as HTMLVideoElement | HTMLAudioElement
    if (Number.isFinite(el.duration)) {
        on_duration?.(el.duration)
    }
}

function handle_time(event: Event) {
    const el = event.currentTarget as HTMLVideoElement | HTMLAudioElement
    if ("requestVideoFrameCallback" in el) {
        return
    }
    if (Number.isFinite(el.currentTime)) {
        on_tick({ media_time: el.currentTime })
    }
}

function handle_seeked(event: Event) {
    const el = event.currentTarget as HTMLVideoElement | HTMLAudioElement
    if (Number.isFinite(el.currentTime)) {
        on_tick({ media_time: el.currentTime })
        on_seeked?.(el.currentTime)
    }
}

$effect(() => {
    wrapper_ref(wrapper_el)
})

$effect(() => {
    void url
    const current = has_video ? video_el : audio_el
    video_ref(current)
    if (!current || !(current instanceof HTMLVideoElement)) {
        return
    }
    if (!("requestVideoFrameCallback" in current)) {
        return
    }
    const rvfc = current as RvfcVideoElement
    let cancelled = false
    let handle = 0
    const loop: RvfcCallback = (_now, metadata) => {
        if (cancelled) {
            return
        }
        on_tick({ media_time: metadata.mediaTime, presented_frames: metadata.presentedFrames })
        handle = rvfc.requestVideoFrameCallback(loop)
    }
    handle = rvfc.requestVideoFrameCallback(loop)
    return () => {
        cancelled = true
        rvfc.cancelVideoFrameCallback(handle)
    }
})
</script>

<div
    bind:this={wrapper_el}
    class="w-full"
>
    {#if has_video}
        <!-- biome-ignore lint/a11y/useMediaCaption: local-file viewer, no caption source -->
        <video
            bind:this={video_el}
            src={url}
            preload="auto"
            class="w-full rounded"
            onloadedmetadata={handle_loaded}
            ontimeupdate={handle_time}
            onseeked={handle_seeked}
            onerror={() => on_error?.()}
        ></video>
    {:else}
        <!-- biome-ignore lint/a11y/useMediaCaption: local-file viewer, no caption source -->
        <audio
            bind:this={audio_el}
            src={url}
            class="w-full"
            onloadedmetadata={handle_loaded}
            ontimeupdate={handle_time}
            onseeked={handle_seeked}
            onerror={() => on_error?.()}
        ></audio>
    {/if}
</div>
