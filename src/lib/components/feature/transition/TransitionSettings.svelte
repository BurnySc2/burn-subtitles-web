<script lang="ts">
import type {
    TransitionAudioQuality,
    TransitionEasing,
    TransitionFpsMode,
    TransitionQuality,
    TransitionResSource,
} from "$lib/media/transition-utils"

export type TransitionResolution = TransitionResSource
export type TransitionFps = TransitionFpsMode
export type { TransitionAudioQuality, TransitionEasing, TransitionQuality }

export interface TransitionSettingsPatch {
    duration?: string
    start?: string
    resolution?: TransitionResolution
    fps?: TransitionFps
    quality?: TransitionQuality
    audio_quality?: TransitionAudioQuality
    crf_override?: string
    easing?: TransitionEasing
}

let {
    duration,
    start,
    resolution,
    fps,
    quality,
    audio_quality,
    crf_override,
    easing,
    on_change,
}: {
    duration: string
    start: string
    resolution: TransitionResolution
    fps: TransitionFps
    quality: TransitionQuality
    audio_quality: TransitionAudioQuality
    crf_override: string
    easing: TransitionEasing
    on_change?: (patch: TransitionSettingsPatch) => void
} = $props()
</script>

<div class="section flex w-full flex-col gap-4">
    <h2 class="section-title text-lg">Transition settings</h2>
    <div>
        <label
            for="transition-duration"
            class="form-label"
        >
            Duration (seconds)
        </label>
        <input
            id="transition-duration"
            type="text"
            value={duration}
            oninput={(event) => on_change?.({ duration: event.currentTarget.value })}
            placeholder="1.0"
            inputmode="decimal"
        >
    </div>
    <div>
        <label
            for="transition-start"
            class="form-label"
        >
            Start on A (seconds)
        </label>
        <input
            id="transition-start"
            type="text"
            value={start}
            oninput={(event) => on_change?.({ start: event.currentTarget.value })}
            placeholder="0"
            inputmode="decimal"
        >
    </div>
    <div>
        <label
            for="transition-resolution"
            class="form-label"
        >
            Resolution
        </label>
        <select
            id="transition-resolution"
            value={resolution}
            onchange={(event) => on_change?.({ resolution: event.currentTarget.value as TransitionResolution })}
        >
            <option value="a">Source A</option>
            <option value="b">Source B</option>
        </select>
    </div>
    <div>
        <label
            for="transition-fps"
            class="form-label"
        >
            Frame rate
        </label>
        <select
            id="transition-fps"
            value={fps}
            onchange={(event) => on_change?.({ fps: event.currentTarget.value as TransitionFps })}
        >
            <option value="a">Source A</option>
            <option value="b">Source B</option>
            <option value="24">24</option>
            <option value="30">30</option>
            <option value="60">60</option>
        </select>
    </div>
    <div>
        <label
            for="transition-quality"
            class="form-label"
        >
            Quality
        </label>
        <select
            id="transition-quality"
            value={quality}
            onchange={(event) => on_change?.({ quality: event.currentTarget.value as TransitionQuality })}
        >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="very-high">Very High</option>
            <option
                value="ultra"
                title="Ultra: high-bitrate, not bit-exact"
            >
                Ultra
            </option>
        </select>
    </div>
    <div>
        <label
            for="transition-audio-quality"
            class="form-label"
        >
            Audio bitrate
        </label>
        <select
            id="transition-audio-quality"
            value={audio_quality}
            onchange={(event) => on_change?.({ audio_quality: event.currentTarget.value as TransitionAudioQuality })}
        >
            <option value="source-max">Source max</option>
            <option value="96k">96k</option>
            <option value="128k">128k</option>
            <option value="192k">192k</option>
            <option value="256k">256k</option>
            <option value="320k">320k</option>
        </select>
    </div>
    <div>
        <label
            for="transition-crf"
            class="form-label"
        >
            CRF override (optional)
        </label>
        <input
            id="transition-crf"
            type="number"
            min="0"
            max="51"
            step="1"
            value={crf_override}
            oninput={(event) => on_change?.({ crf_override: event.currentTarget.value })}
            placeholder="22"
            inputmode="decimal"
        >
    </div>
    <div>
        <label
            for="transition-easing"
            class="form-label"
        >
            Easing
        </label>
        <select
            id="transition-easing"
            value={easing}
            onchange={(event) => on_change?.({ easing: event.currentTarget.value as TransitionEasing })}
        >
            <option value="linear">linear</option>
            <option value="exponential">exponential</option>
        </select>
    </div>
</div>
