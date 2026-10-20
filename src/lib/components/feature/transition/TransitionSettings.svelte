<script lang="ts">
import type {
    TransitionEasing,
    TransitionFpsMode,
    TransitionQuality,
    TransitionResSource,
} from "$lib/media/transition-utils"

export type TransitionResolution = TransitionResSource
export type TransitionFps = TransitionFpsMode
export type { TransitionEasing, TransitionQuality }

export interface TransitionSettingsPatch {
    duration?: string
    resolution?: TransitionResolution
    fps?: TransitionFps
    quality?: TransitionQuality
    easing?: TransitionEasing
}

let {
    duration,
    resolution,
    fps,
    quality,
    easing,
    on_change,
}: {
    duration: string
    resolution: TransitionResolution
    fps: TransitionFps
    quality: TransitionQuality
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
            <option value="lossless">Lossless</option>
        </select>
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
